import type { Identity } from "@dfinity/agent";
import { idlFactory, type GroupService } from "./candid/idl";
import type {
    EventsResponse,
    GroupChatEvent,
    Message,
    SendMessageResponse,
    RemoveMemberResponse,
    UpdateGroupResponse,
    AddRemoveReactionResponse,
    IndexRange,
    DeleteMessageResponse,
    UndeleteMessageResponse,
    EditMessageResponse,
    BlockUserResponse,
    ChangeRoleResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    UnblockUserResponse,
    MemberRole,
    PinMessageResponse,
    UnpinMessageResponse,
    RegisterPollVoteResponse,
    InviteCodeResponse,
    EnableInviteCodeResponse,
    DisableInviteCodeResponse,
    ResetInviteCodeResponse,
    ThreadPreviewsResponse,
    RegisterProposalVoteResponse,
    Rules,
    SearchGroupChatResponse,
    User,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    DeletedGroupMessageResponse,
    EventWrapper,
    OptionUpdate,
    ClaimPrizeResponse,
    AccessGate,
    DeclineInvitationResponse,
    EventsSuccessResult,
    ChatEvent,
    GroupChatIdentifier,
    ConvertToCommunityResponse,
    PublicGroupSummaryResponse,
    UpdatedRules,
    FollowThreadResponse,
    OptionalChatPermissions,
    ToggleMuteNotificationResponse,
} from "openchat-shared";
import {
    DestinationInvalidError,
    offline,
    textToCode,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    apiRole,
    getEventsResponse,
    sendMessageResponse,
    removeMemberResponse,
    blockUserResponse,
    unblockUserResponse,
    getMessagesByMessageIndexResponse,
    apiOptionalGroupPermissions,
    summaryResponse,
    summaryUpdatesResponse,
    convertToCommunityReponse,
    apiUpdatedRules,
    followThreadResponse,
    reportMessageResponse,
} from "./mappers";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedGroupDetails,
} from "../../utils/caching";
import { Principal } from "@dfinity/principal";
import {
    addRemoveReactionResponse,
    apiAccessGate,
    inviteCodeResponse,
    searchGroupChatResponse,
    declineInvitationResponse,
    threadPreviewsResponse,
    apiMessageContent,
    changeRoleResponse,
    undeleteMessageResponse,
    editMessageResponse,
    deleteMessageResponse,
    apiOptional,
    deletedMessageResponse,
    updateGroupResponse,
    registerPollVoteResponse,
    apiUser,
    enableInviteCodeResponse,
    disableInviteCodeResponse,
    resetInviteCodeResponse,
    pinMessageResponse,
    unpinMessageResponse,
    groupDetailsResponse,
    groupDetailsUpdatesResponse,
    registerProposalVoteResponse,
    claimPrizeResponse,
} from "../common/chatMappers";
import { DataClient } from "../data/data.client";
import { mergeGroupChatDetails } from "../../utils/chat";
import { publicSummaryResponse } from "../common/publicSummaryMapper";
import { apiOptionUpdate, identity } from "../../utils/mapping";
import { generateUint64 } from "../../utils/rng";
import type { AgentConfig } from "../../config";
import { setCachedMessageFromSendResponse } from "../../utils/caching";
import { muteNotificationsResponse } from "../notifications/mappers";

export class GroupClient extends CandidService {
    private groupService: GroupService;

    constructor(
        identity: Identity,
        private config: AgentConfig,
        private chatId: GroupChatIdentifier,
        private db: Database,
        private inviteCode: string | undefined,
    ) {
        super(identity);
        this.groupService = this.createServiceClient<GroupService>(
            idlFactory,
            chatId.groupId,
            config,
        );
    }

    static create(
        chatId: GroupChatIdentifier,
        identity: Identity,
        config: AgentConfig,
        db: Database,
        inviteCode: string | undefined,
    ): GroupClient {
        return new GroupClient(identity, config, chatId, db, inviteCode);
    }

    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.handleQueryResponse(
            () => this.groupService.summary({}),
            summaryResponse,
            {},
        ).catch((err) => {
            if (err instanceof DestinationInvalidError) {
                return { kind: "canister_not_found" };
            } else {
                throw err;
            }
        });
    }

    summaryUpdates(updatesSince: bigint): Promise<GroupCanisterSummaryUpdatesResponse> {
        const args = { updates_since: updatesSince };

        return this.handleQueryResponse(
            () => this.groupService.summary_updates(args),
            summaryUpdatesResponse,
            args,
        );
    }

    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        return getCachedEventsByIndex<GroupChatEvent>(this.db, eventIndexes, {
            chatId: this.chatId,
            threadRootMessageIndex,
        }).then((res) => this.handleMissingEvents(res, threadRootMessageIndex, latestKnownUpdate));
    }

    private setCachedEvents<T extends ChatEvent>(
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number,
    ): EventsResponse<T> {
        setCachedEvents(this.db, this.chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err),
        );
        return resp;
    }

    private handleMissingEvents(
        [cachedEvents, missing]: [EventsSuccessResult<GroupChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .then((resp) => {
                    if (resp !== "events_failed") {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    chatEventsByIndexFromBackend(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            events: new Uint32Array(eventIndexes),
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.events_by_index(args),
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            args,
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing, totalMiss] =
            await getCachedEventsWindowByMessageIndex<GroupChatEvent>(
                this.db,
                eventIndexRange,
                { chatId: this.chatId, threadRootMessageIndex },
                messageIndex,
            );

        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return this.chatEventsWindowFromBackend(
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents([cachedEvents, missing], undefined, latestKnownUpdate);
        }
    }

    private async chatEventsWindowFromBackend(
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            mid_point: messageIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.events_window(args),
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            args,
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents<GroupChatEvent>(
            this.db,
            eventIndexRange,
            { chatId: this.chatId, threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api", missing.size);
            return this.chatEventsFromBackend(
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private chatEventsFromBackend(
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<GroupChatEvent>> {
        const args = {
            thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            max_messages: MAX_MESSAGES,
            max_events: MAX_EVENTS,
            ascending,
            start_index: startIndex,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.events(args),
            (resp) => getEventsResponse(this.principal, resp, this.chatId, latestKnownUpdate),
            args,
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        return this.handleResponse(
            this.groupService.change_role({
                user_id: Principal.fromText(userId),
                new_role,
                correlation_id: generateUint64(),
            }),
            changeRoleResponse,
        );
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.handleResponse(
            this.groupService.remove_participant({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            removeMemberResponse,
        );
    }

    editMessage(message: Message, threadRootMessageIndex?: number): Promise<EditMessageResponse> {
        return DataClient.create(this.identity, this.config)
            .uploadData(message.content, [this.chatId.groupId])
            .then((content) => {
                return this.handleResponse(
                    this.groupService.edit_message_v2({
                        thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                        content: apiMessageContent(content ?? message.content),
                        message_id: message.messageId,
                        correlation_id: generateUint64(),
                    }),
                    editMessageResponse,
                );
            });
    }

    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.handleResponse(
            this.groupService.claim_prize({
                correlation_id: generateUint64(),
                message_id: messageId,
            }),
            claimPrizeResponse,
        );
    }

    sendMessage(
        senderName: string,
        senderDisplayName: string | undefined,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = DataClient.create(this.identity, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.chatId.groupId])
            : dataClient.uploadData(event.event.content, [this.chatId.groupId]);

        return uploadContentPromise.then((content) => {
            const newContent = content ?? event.event.content;
            const args = {
                content: apiMessageContent(newContent),
                message_id: event.event.messageId,
                sender_name: senderName,
                sender_display_name: apiOptional(identity, senderDisplayName),
                rules_accepted: apiOptional(identity, rulesAccepted),
                replies_to: apiOptional(
                    (replyContext) => ({
                        event_index: replyContext.eventIndex,
                    }),
                    event.event.repliesTo,
                ),
                mentioned: mentioned.map(apiUser),
                forwarding: event.event.forwarded,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                correlation_id: generateUint64(),
            };
            return this.handleResponse(this.groupService.send_message_v2(args), sendMessageResponse)
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [
                        resp,
                        { ...event.event, content: newContent },
                    ];
                    setCachedMessageFromSendResponse(
                        this.db,
                        this.chatId,
                        event,
                        threadRootMessageIndex,
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, this.chatId, event, threadRootMessageIndex);
                    throw err;
                });
        });
    }

    updateGroup(
        name?: string,
        description?: string,
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>,
        gate?: AccessGate,
        isPublic?: boolean,
    ): Promise<UpdateGroupResponse> {
        return this.handleResponse(
            this.groupService.update_group_v2({
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                public: apiOptional(identity, isPublic),
                avatar:
                    avatar === undefined
                        ? { NoChange: null }
                        : {
                              SetToSome: {
                                  id: DataClient.newBlobId(),
                                  mime_type: "image/jpg",
                                  data: avatar,
                              },
                          },
                permissions_v2: apiOptional(apiOptionalGroupPermissions, permissions),
                rules: apiOptional(apiUpdatedRules, rules),
                events_ttl: apiOptionUpdate(identity, eventsTimeToLiveMs),
                correlation_id: generateUint64(),
                gate:
                    gate === undefined
                        ? { NoChange: null }
                        : gate.kind === "no_gate"
                          ? { SetToNone: null }
                          : { SetToSome: apiAccessGate(gate) },
            }),
            updateGroupResponse,
        );
    }

    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        displayName: string | undefined,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.add_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                username,
                display_name: apiOptional(identity, displayName),
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse,
        );
    }

    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.handleResponse(
            this.groupService.remove_reaction({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                reaction,
                correlation_id: generateUint64(),
            }),
            addRemoveReactionResponse,
        );
    }

    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
        asPlatformModerator?: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.delete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
                as_platform_moderator: apiOptional(identity, asPlatformModerator),
            }),
            deleteMessageResponse,
        );
    }

    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.handleResponse(
            this.groupService.undelete_messages({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_ids: [messageId],
                correlation_id: generateUint64(),
            }),
            undeleteMessageResponse,
        );
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.handleResponse(
            this.groupService.block_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            blockUserResponse,
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.handleResponse(
            this.groupService.unblock_user({
                user_id: Principal.fromText(userId),
                correlation_id: generateUint64(),
            }),
            unblockUserResponse,
        );
    }

    async getGroupDetails(chatLastUpdated: bigint): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId.groupId);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= chatLastUpdated || offline()) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }

        const response = await this.getGroupDetailsFromBackend();
        if (response !== "failure") {
            await setCachedGroupDetails(this.db, this.chatId.groupId, response);
        }
        return response;
    }

    private getGroupDetailsFromBackend(): Promise<GroupChatDetailsResponse> {
        return this.handleQueryResponse(
            () => this.groupService.selected_initial({}),
            groupDetailsResponse,
        );
    }

    private async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.getGroupDetailsUpdatesFromBackend(previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, this.chatId.groupId, response);
        }
        return response;
    }

    private async getGroupDetailsUpdatesFromBackend(
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const args = {
            updates_since: previous.timestamp,
        };
        const updatesResponse = await this.handleQueryResponse(
            () => this.groupService.selected_updates_v2(args),
            groupDetailsUpdatesResponse,
            args,
        );

        if (updatesResponse.kind === "failure") {
            return previous;
        }

        if (updatesResponse.kind === "success_no_updates") {
            return {
                ...previous,
                timestamp: updatesResponse.timestamp,
            };
        }

        return mergeGroupChatDetails(previous, updatesResponse);
    }

    getPublicSummary(): Promise<PublicGroupSummaryResponse> {
        const args = { invite_code: apiOptional(textToCode, this.inviteCode) };
        return this.handleQueryResponse(
            () => this.groupService.public_summary(args),
            publicSummaryResponse,
            args,
        );
    }

    async getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                fromCache.missing,
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(resp));

            return resp === "events_failed"
                ? resp
                : {
                      events: [...fromCache.messageEvents, ...resp.events],
                      expiredEventRanges: [],
                      expiredMessageRanges: [],
                      latestEventIndex: resp.latestEventIndex,
                  };
        }
        return {
            events: fromCache.messageEvents,
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        };
    }

    private getMessagesByMessageIndexFromBackend(
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const thread_root_message_index: [] = [];
        const invite_code: [] = [];
        const args = {
            thread_root_message_index,
            messages: new Uint32Array(messageIndexes),
            invite_code,
            latest_known_update: apiOptional(identity, latestKnownUpdate),
            latest_client_event_index: [] as [] | [number],
        };
        return this.handleQueryResponse(
            () => this.groupService.messages_by_message_index(args),
            (resp) =>
                getMessagesByMessageIndexResponse(
                    this.principal,
                    resp,
                    this.chatId,
                    latestKnownUpdate,
                ),
            args,
        );
    }

    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.handleResponse(
            this.groupService.deleted_message({
                message_id: messageId,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
            }),
            deletedMessageResponse,
        );
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.handleResponse(
            this.groupService.pin_message_v2({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            pinMessageResponse,
        );
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.handleResponse(
            this.groupService.unpin_message({
                message_index: messageIndex,
                correlation_id: generateUint64(),
            }),
            unpinMessageResponse,
        );
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex?: number,
    ): Promise<RegisterPollVoteResponse> {
        return this.handleResponse(
            this.groupService.register_poll_vote({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                poll_option: answerIdx,
                operation: voteType === "register" ? { RegisterVote: null } : { DeleteVote: null },
                message_index: messageIdx,
                correlation_id: generateUint64(),
            }),
            registerPollVoteResponse,
        );
    }

    searchGroupChat(
        searchTerm: string,
        userIds: string[],
        maxResults: number,
    ): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            users: apiOptional(
                identity,
                userIds.map((u) => Principal.fromText(u)),
            ),
        };
        return this.handleQueryResponse(
            () => this.groupService.search_messages(args),
            (res) => searchGroupChatResponse(res, this.chatId),
            args,
        );
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.handleQueryResponse(
            () => this.groupService.invite_code({}),
            inviteCodeResponse,
        );
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.enable_invite_code({
                correlation_id: generateUint64(),
            }),
            enableInviteCodeResponse,
        );
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.disable_invite_code({
                correlation_id: generateUint64(),
            }),
            disableInviteCodeResponse,
        );
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.handleResponse(
            this.groupService.reset_invite_code({
                correlation_id: generateUint64(),
            }),
            resetInviteCodeResponse,
        );
    }

    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.handleQueryResponse(
            () =>
                this.groupService.thread_previews({
                    threads: new Uint32Array(threadRootMessageIndexes),
                    latest_client_thread_update: apiOptional(identity, latestClientThreadUpdate),
                }),
            (resp) => threadPreviewsResponse(resp, this.chatId, latestClientThreadUpdate),
        );
    }

    registerProposalVote(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse,
        );
    }

    registerProposalVoteV2(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.handleResponse(
            this.groupService.register_proposal_vote_v2({
                adopt,
                message_index: messageIdx,
            }),
            registerProposalVoteResponse,
        );
    }

    localUserIndex(): Promise<string> {
        return this.handleQueryResponse(
            () => this.groupService.local_user_index({}),
            (resp) => resp.Success.toString(),
        );
    }

    declineInvitation(): Promise<DeclineInvitationResponse> {
        return this.handleResponse(
            this.groupService.decline_invitation({}),
            declineInvitationResponse,
        );
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteNotificationResponse> {
        return this.handleResponse(
            this.groupService.toggle_mute_notifications({ mute }),
            muteNotificationsResponse,
        );
    }

    convertToCommunity(historyVisible: boolean, rules: Rules): Promise<ConvertToCommunityResponse> {
        return this.handleResponse(
            this.groupService.convert_into_community({
                history_visible_to_new_joiners: historyVisible,
                primary_language: [],
                permissions: [],
                rules,
            }),
            convertToCommunityReponse,
        );
    }

    followThread(threadRootMessageIndex: number, follow: boolean): Promise<FollowThreadResponse> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
        };
        return this.handleResponse(
            follow
                ? this.groupService.follow_thread(args)
                : this.groupService.unfollow_thread(args),
            followThreadResponse,
        );
    }

    reportMessage(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.handleResponse(
            this.groupService.report_message({
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                message_id: messageId,
                delete: deleteMessage,
            }),
            reportMessageResponse,
        );
    }
}
