<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import type { OpenChat } from "openchat-client";
    import SendCrypto from "./SendCrypto.svelte";

    export let ledger: string;
    export let mode: "send" | "receive";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let sendCrypto: SendCrypto;
    let error: string | undefined = undefined;
    let amountToSend = BigInt(0);
    let balanceWithRefresh: BalanceWithRefresh;
    let busy = false;
    let capturingAccount = false;
    let valid = false;

    $: user = client.user;
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: transferFees = tokenDetails.transferFee;
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: title =
        mode === "receive"
            ? $_("cryptoAccount.receiveToken", { values: { symbol } })
            : $_("cryptoAccount.sendToken", { values: { symbol } });
    $: cryptoBalance = client.cryptoBalance;

    $: remainingBalance =
        amountToSend > BigInt(0)
            ? $cryptoBalance[ledger] - amountToSend - transferFees
            : $cryptoBalance[ledger];

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = ev.detail;
    }

    function saveAccount() {
        if (sendCrypto) {
            busy = true;
            sendCrypto
                .saveAccount()
                .then((resp) => {
                    if (resp.kind === "success") {
                        dispatch("close");
                    } else if (resp.kind === "name_taken") {
                        error = "tokenTransfer.accountNameTaken";
                    } else {
                        error = "tokenTransfer.failedToSaveAccount";
                    }
                })
                .finally(() => (busy = false));
        }
    }
</script>

<Overlay on:close dismissible>
    <ModalContent>
        <span class="header" slot="header">
            <div class="main-title">{title}</div>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {ledger}
                value={remainingBalance}
                label={$_("cryptoAccount.shortBalanceLabel")}
                minDecimals={2}
                bold
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form class={`body ${mode}`} slot="body">
            {#if mode === "receive"}
                <AccountInfo qrSize={"larger"} centered {ledger} user={$user} />
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol } })}
                </a>
            {/if}

            {#if mode === "send"}
                <SendCrypto
                    bind:this={sendCrypto}
                    bind:busy
                    bind:capturingAccount
                    bind:valid
                    on:close
                    on:error={(ev) => (error = ev.detail)}
                    on:refreshBalance={() => balanceWithRefresh.refresh()}
                    {ledger}
                    bind:amountToSend />
            {/if}
            {#if error}
                <ErrorMessage>{$_(error)}</ErrorMessage>
            {/if}
        </form>
        <span slot="footer">
            <ButtonGroup>
                {#if mode === "send"}
                    {#if capturingAccount}
                        <Button secondary tiny={$mobileWidth} on:click={() => dispatch("close")}
                            >{$_("noThanks")}</Button>
                        <Button
                            disabled={busy || !valid}
                            loading={busy}
                            tiny={$mobileWidth}
                            on:click={saveAccount}>{$_("tokenTransfer.saveAccount")}</Button>
                    {:else}
                        <Button secondary tiny={$mobileWidth} on:click={() => dispatch("close")}
                            >{$_("cancel")}</Button>
                        <Button
                            disabled={busy || !valid}
                            loading={busy}
                            tiny={$mobileWidth}
                            on:click={() => sendCrypto?.send()}>{$_("tokenTransfer.send")}</Button>
                    {/if}
                {:else}
                    <Button tiny={$mobileWidth} on:click={() => dispatch("close")}
                        >{$_("close")}</Button>
                {/if}
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp4;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
        }
    }
    .how-to {
        margin-top: $sp3;
    }

    .body {
        display: flex;
        flex-direction: column;

        &.receive {
            align-items: center;
        }
    }
</style>
