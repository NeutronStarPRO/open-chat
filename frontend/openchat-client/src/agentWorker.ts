import {
    type WorkerRequest,
    MessagesReadFromServer,
    type FromWorker,
    StorageUpdated,
    UsersLoaded,
    type WorkerResponse,
    type WorkerError,
    type WorkerResult,
} from "openchat-shared";
import type { OpenChatConfig } from "./config";
import { v4 } from "uuid";
import { Stream } from "openchat-shared";

const WORKER_TIMEOUT = 1000 * 90;

type UnresolvedRequest = {
    kind: string;
    sentAt: number;
};

type PromiseResolver<T> = {
    resolve: (val: T | PromiseLike<T>, final: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void;
    timeout: number;
};

/**
 * This is a wrapper around the OpenChatAgent which brokers communication with the agent inside a web worker
 */
export class OpenChatAgentWorker extends EventTarget {
    private _worker!: Worker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _pending: Map<string, PromiseResolver<any>> = new Map(); // in-flight requests
    private _unresolved: Map<string, UnresolvedRequest> = new Map(); // requests that never resolved
    private _connectedToWorker = false;

    constructor(protected config: OpenChatConfig) {
        super();
    }

    protected connectToWorker(): Promise<boolean> {
        console.debug("WORKER_CLIENT: loading worker with version: ", this.config.websiteVersion);
        this._worker = new Worker(`/worker.js?v=${this.config.websiteVersion}`, { type: "module" });
        const ready = new Promise<boolean>((resolve) => {
            this.sendRequest(
                {
                    kind: "init",
                    icUrl: this.config.icUrl ?? window.location.origin,
                    iiDerivationOrigin: this.config.iiDerivationOrigin,
                    openStorageIndexCanister: this.config.openStorageIndexCanister,
                    groupIndexCanister: this.config.groupIndexCanister,
                    notificationsCanister: this.config.notificationsCanister,
                    onlineCanister: this.config.onlineCanister,
                    userIndexCanister: this.config.userIndexCanister,
                    registryCanister: this.config.registryCanister,
                    internetIdentityUrl: this.config.internetIdentityUrl,
                    nfidUrl: this.config.nfidUrl,
                    userGeekApiKey: this.config.userGeekApiKey,
                    enableMultiCrypto: this.config.enableMultiCrypto,
                    blobUrlPattern: this.config.blobUrlPattern,
                    proposalBotCanister: this.config.proposalBotCanister,
                    marketMakerCanister: this.config.marketMakerCanister,
                    websiteVersion: this.config.websiteVersion,
                    rollbarApiKey: this.config.rollbarApiKey,
                    env: this.config.env,
                },
                true,
            ).then(() => {
                resolve(true);
                this._connectedToWorker = true;
            });
        });

        this._worker.onmessage = (ev: MessageEvent<FromWorker>) => {
            if (!ev.data) {
                console.debug("WORKER_CLIENT: event message with no data received");
                return;
            }

            const data = ev.data;

            if (data.kind === "worker_event") {
                if (data.event.subkind === "messages_read_from_server") {
                    this.dispatchEvent(
                        new MessagesReadFromServer(
                            data.event.chatId,
                            data.event.readByMeUpTo,
                            data.event.threadsRead,
                            data.event.dateReadPinned,
                        ),
                    );
                }
                if (data.event.subkind === "storage_updated") {
                    this.dispatchEvent(new StorageUpdated(data.event.status));
                }
                if (data.event.subkind === "users_loaded") {
                    this.dispatchEvent(new UsersLoaded(data.event.users));
                }
            } else if (data.kind === "worker_response") {
                console.debug("WORKER_CLIENT: response: ", ev);
                this.resolveResponse(data);
            } else if (data.kind === "worker_error") {
                console.debug("WORKER_CLIENT: error: ", ev);
                this.resolveError(data);
            } else {
                console.debug("WORKER_CLIENT: unknown message: ", ev);
            }
        };
        return ready;
    }

    private logUnexpected(correlationId: string): void {
        const unresolved = this._unresolved.get(correlationId);
        const timedOut =
            unresolved === undefined
                ? ""
                : `Timed-out req of kind: ${unresolved.kind} received after ${
                      Date.now() - unresolved.sentAt
                  }ms`;
        console.error(
            `WORKER_CLIENT: unexpected correlationId received (${correlationId}). ${timedOut}`,
        );
    }

    private resolveResponse(data: WorkerResponse): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.resolve(data.response, data.final);
            if (data.final) {
                window.clearTimeout(promise.timeout);
                this._pending.delete(data.correlationId);
            }
        } else {
            this.logUnexpected(data.correlationId);
        }
        this._unresolved.delete(data.correlationId);
    }

    private resolveError(data: WorkerError): void {
        const promise = this._pending.get(data.correlationId);
        if (promise !== undefined) {
            promise.reject(JSON.parse(data.error));
            window.clearTimeout(promise.timeout);
            this._pending.delete(data.correlationId);
        } else {
            this.logUnexpected(data.correlationId);
        }
        this._unresolved.delete(data.correlationId);
    }

    responseHandler<Req extends WorkerRequest, T>(
        req: Req,
        correlationId: string,
    ): (resolve: (val: T, final: boolean) => void, reject: (reason?: unknown) => void) => void {
        return (resolve, reject) => {
            const sentAt = Date.now();
            this._pending.set(correlationId, {
                resolve,
                reject,
                timeout: window.setTimeout(() => {
                    reject(
                        `WORKER_CLIENT: Request of kind ${req.kind} with correlationId ${correlationId} did not receive a response withing the ${WORKER_TIMEOUT}ms timeout`,
                    );
                    this._unresolved.set(correlationId, {
                        kind: req.kind,
                        sentAt,
                    });
                    this._pending.delete(correlationId);
                }, WORKER_TIMEOUT),
            });
        };
    }

    sendStreamRequest<Req extends WorkerRequest>(
        req: Req,
        connecting = false,
    ): Stream<WorkerResult<Req>> {
        if (!connecting && !this._connectedToWorker) {
            throw new Error("WORKER_CLIENT: the client is not yet connected to the worker");
        }
        const correlationId = v4();
        this._worker.postMessage({
            ...req,
            correlationId,
        });
        return new Stream<WorkerResult<Req>>(this.responseHandler(req, correlationId));
    }

    async sendRequest<Req extends WorkerRequest>(
        req: Req,
        connecting = false,
    ): Promise<WorkerResult<Req>> {
        if (!connecting && !this._connectedToWorker) {
            throw new Error("WORKER_CLIENT: the client is not yet connected to the worker");
        }
        const correlationId = v4();
        this._worker.postMessage({
            ...req,
            correlationId,
        });
        return new Promise<WorkerResult<Req>>(this.responseHandler(req, correlationId));
    }
}
