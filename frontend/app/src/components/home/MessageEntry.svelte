<script lang="ts">
    import Send from "svelte-material-icons/Send.svelte";
    import ContentSaveEditOutline from "svelte-material-icons/ContentSaveMoveOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import AudioAttacher from "./AudioAttacher.svelte";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import Progress from "../Progress.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import MentionPicker from "./MentionPicker.svelte";
    import EmojiAutocompleter from "./EmojiAutocompleter.svelte";
    import type {
        User,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        Message,
        MessageAction,
        Questions,
        OpenChat,
        MultiUserChat,
        UserOrUserGroup,
        AttachmentContent,
    } from "openchat-client";
    import { allQuestions, chatIdentifiersEqual } from "openchat-client";
    import { enterSend } from "../../stores/settings";
    import MessageActions from "./MessageActions.svelte";
    import { addQueryStringParam } from "../../utils/urls";
    import PreviewFooter from "./PreviewFooter.svelte";
    import { preferredDarkThemeName, themeType, currentThemeName } from "../../theme/themes";
    import { scream } from "../../utils/scream";

    const client = getContext<OpenChat>("client");

    export let chat: ChatSummary;
    export let blocked: boolean;
    export let preview: boolean;
    export let messageAction: MessageAction = undefined;
    export let joining: MultiUserChat | undefined;
    export let attachment: AttachmentContent | undefined;
    export let editingEvent: EventWrapper<Message> | undefined;
    export let replyingTo: EnhancedReplyContext | undefined;
    export let textContent: string | undefined;
    export let mode: "thread" | "message" = "message";

    const USER_TYPING_EVENT_MIN_INTERVAL_MS = 1000; // 1 second
    const MARK_TYPING_STOPPED_INTERVAL_MS = 5000; // 5 seconds

    const mentionRegex = /@(\w*)$/;
    const emojiRegex = /:(\w+):?$/;
    const dispatch = createEventDispatcher();
    let inp: HTMLDivElement;
    let audioMimeType = client.audioRecordingMimeType();
    let selectedRange: Range | undefined;
    let dragging: boolean = false;
    let recording: boolean = false;
    let percentRecorded: number = 0;
    let previousEditingEvent: EventWrapper<Message> | undefined;
    let lastTypingUpdate: number = 0;
    let typingTimer: number | undefined = undefined;
    let audioSupported: boolean = "mediaDevices" in navigator;
    let showMentionPicker = false;
    let showEmojiSearch = false;
    let mentionPrefix: string | undefined;
    let emojiQuery: string | undefined;
    let messageEntryHeight: number;
    let messageActions: MessageActions;
    let rangeToReplace: [number, number] | undefined = undefined;
    let previousChatId = chat.id;

    // Update this to force a new textbox instance to be created
    let textboxId = Symbol();

    $: userStore = client.userStore;
    $: userGroups = client.currentCommunityUserGroups;
    $: messageIsEmpty = (textContent?.trim() ?? "").length === 0 && attachment === undefined;
    $: cryptoLookup = client.cryptoLookup;
    $: tokens = Object.values($cryptoLookup)
        .map((t) => t.symbol.toLowerCase())
        .join("|");
    $: tokenMatchRegex = new RegExp(`^\/(${tokens}) *(\\d*[.,]?\\d*)$`);

    $: canSendAny = client.canSendMessage(chat.id, mode);
    $: permittedMessages = client.permittedMessages(chat.id, mode);
    $: canEnterText =
        (permittedMessages.get("text") ?? false) ||
        editingEvent !== undefined ||
        attachment !== undefined;

    $: {
        if (inp) {
            if (editingEvent && editingEvent.index !== previousEditingEvent?.index) {
                if (editingEvent.event.content.kind === "text_content") {
                    inp.textContent = formatUserGroupMentions(
                        formatUserMentions(editingEvent.event.content.text),
                    );
                    selectedRange = undefined;
                    restoreSelection();
                } else if ("caption" in editingEvent.event.content) {
                    inp.textContent = editingEvent.event.content.caption ?? "";
                    selectedRange = undefined;
                    restoreSelection();
                }
                previousEditingEvent = editingEvent;
            } else {
                const text = textContent ?? "";
                // Only set the textbox text when required rather than every time, because doing so sets the focus back to
                // the start of the textbox on some devices.
                if (inp.textContent !== text) {
                    inp.textContent = text;
                    // TODO - figure this out
                    // setCaretToEnd();
                }
            }
        }

        if (editingEvent === undefined) {
            previousEditingEvent = undefined;
        }
    }

    $: {
        // If the chat has changed, close the emoji picker or file selector
        if (!chatIdentifiersEqual(chat.id, previousChatId)) {
            messageAction = undefined;
            previousChatId = chat.id;
        }
    }

    $: {
        if (attachment !== undefined || replyingTo !== undefined) {
            inp?.focus();
        }
    }

    $: {
        if ($screenWidth === ScreenWidth.Large) {
            inp?.focus();
        }
    }

    $: placeholder = !canEnterText
        ? $_("sendTextDisabled")
        : attachment !== undefined
          ? $_("enterCaption")
          : dragging
            ? $_("dropFile")
            : $_("enterMessage");

    export function replaceSelection(text: string) {
        restoreSelection();
        let range = window.getSelection()?.getRangeAt(0);
        if (range !== undefined) {
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            const inputContent = inp.textContent ?? "";
            dispatch("setTextContent", inputContent.trim().length === 0 ? undefined : inputContent);
        }
    }

    function onInput() {
        const inputContent = inp.textContent ?? "";
        dispatch("setTextContent", inputContent.trim().length === 0 ? undefined : inputContent);
        triggerMentionLookup(inputContent);
        triggerEmojiLookup(inputContent);
        triggerTypingTimer();
    }

    function uptoCaret(
        inputContent: string | null,
        fn: (slice: string, pos: number) => void,
    ): void {
        if (inputContent === null) return;

        const pos = window.getSelection()?.anchorOffset;
        if (pos === undefined) return;

        const slice = inputContent.slice(0, pos);
        fn(slice, pos);
    }

    function triggerEmojiLookup(inputContent: string | null): void {
        uptoCaret(inputContent, (slice: string, pos: number) => {
            const matches = slice.match(emojiRegex);
            if (matches !== null) {
                if (matches.index !== undefined) {
                    rangeToReplace = [matches.index, pos];
                    emojiQuery = matches[1].toLowerCase() || undefined;
                    showEmojiSearch = true;
                }
            } else {
                showEmojiSearch = false;
                emojiQuery = undefined;
            }
        });
    }

    function triggerMentionLookup(inputContent: string | null): void {
        if (chat.kind === "direct_chat" || chat.memberCount <= 1) return;
        uptoCaret(inputContent, (slice: string, pos: number) => {
            const matches = slice.match(mentionRegex);
            if (matches !== null) {
                if (matches.index !== undefined) {
                    rangeToReplace = [matches.index, pos];
                    mentionPrefix = matches[1].toLowerCase() || undefined;
                    showMentionPicker = true;
                }
            } else {
                showMentionPicker = false;
                mentionPrefix = undefined;
            }
        });
    }

    function triggerTypingTimer() {
        requestAnimationFrame(() => {
            const now = Date.now();
            if (now - lastTypingUpdate > USER_TYPING_EVENT_MIN_INTERVAL_MS) {
                lastTypingUpdate = now;
                dispatch("startTyping");
            }
            if (typingTimer !== undefined) {
                window.clearTimeout(typingTimer);
            }

            typingTimer = window.setTimeout(
                () => dispatch("stopTyping"),
                MARK_TYPING_STOPPED_INTERVAL_MS,
            );
        });
    }

    function keyPress(e: KeyboardEvent) {
        if (e.key === "Enter" && $enterSend && !e.shiftKey) {
            if (!messageIsEmpty) {
                sendMessage();
            }
            e.preventDefault();
        }
    }

    function formatUserMentions(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $userStore[p1];
            if (u?.username !== undefined) {
                const username = u.username;
                return `@${username}`;
            }
            return match;
        });
    }

    function formatUserGroupMentions(text: string): string {
        return text.replace(/@UserGroup\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $userGroups.get(Number(p1));
            if (u !== undefined) {
                return `@${u.name}`;
            }
            return match;
        });
    }

    // replace anything of the form @username with @UserId(xyz) or @UserGroup(abc) where
    // xyz is the userId or abc is the user group id
    // if we can't find the user or user group just leave it as is
    function expandMentions(text?: string): [string | undefined, User[]] {
        let mentionedMap = new Map<string, User>();
        let expandedText = text?.replace(/@(\w+)/g, (match, p1) => {
            const userOrGroup = client.lookupUserForMention(p1, false);
            if (userOrGroup !== undefined) {
                switch (userOrGroup.kind) {
                    case "user_group":
                        return `@UserGroup(${userOrGroup.id})`;
                    case "everyone":
                        return "@everyone";
                    default:
                        mentionedMap.set(userOrGroup.userId, userOrGroup);
                        return `@UserId(${userOrGroup.userId})`;
                }
            } else {
                return match;
            }
        });

        let mentioned = Array.from(mentionedMap, ([_, user]) => user);

        return [expandedText, mentioned];
    }

    /**
     * Check the message content for special commands
     * * /poll - creates a poll
     * * /icp [amount]
     * * /search [term]
     * * /pinned - opens pinned messages (not yet)
     * * /details - opens group details (not yet)
     * * /witch - summon the halloween witch
     */
    function parseCommands(txt: string): boolean {
        const summonWitch = txt.match(/^\/witch( *(.*))$/);
        const isHalloweenTheme = $currentThemeName === "halloween";
        if (summonWitch) {
            if (!isHalloweenTheme) {
                themeType.set("dark");
                preferredDarkThemeName.set("halloween");
            }
            document.body.classList.add("witch");
            scream.currentTime = 0;
            scream.play();
            window.setTimeout(() => {
                document.body.classList.remove("witch");
            }, 2000);
            return false;
        }

        if (permittedMessages.get("poll") && /^\/poll$/.test(txt)) {
            dispatch("createPoll");
            return true;
        }

        const testMsgMatch = txt.match(/^\/test-msg (\d+)/);
        if (testMsgMatch && testMsgMatch[1] !== undefined) {
            dispatch("createTestMessages", Number(testMsgMatch[1]));
            return true;
        }

        const searchMatch = txt.match(/^\/search( *(.*))$/);
        if (searchMatch && searchMatch[2] !== undefined) {
            dispatch("searchChat", searchMatch[2]);
            return true;
        }

        if (permittedMessages.get("giphy")) {
            const gifMatch = txt.match(/^\/gif( *(.*))$/);
            if (gifMatch && gifMatch[2] !== undefined) {
                dispatch("attachGif", gifMatch[2]);
                return true;
            }
        }

        const faqMatch = txt.match(/^\/faq( *(.*))$/);
        if (faqMatch && faqMatch[2] !== undefined) {
            if (allQuestions.includes(faqMatch[2] as Questions)) {
                const url = `/faq?q=${faqMatch[2]}`;
                dispatch("sendMessage", [`[🤔 FAQ: ${$_(`faq.${faqMatch[2]}_q`)}](${url})`, []]);
            } else {
                dispatch("sendMessage", [`[🤔 FAQs](/faq)`, []]);
            }
            return true;
        }

        if (/^\/diamond$/.test(txt)) {
            const url = addQueryStringParam("diamond", "");
            dispatch("sendMessage", [`[${$_("upgrade.message")}](${url})`, []]);
            return true;
        }

        if (permittedMessages.get("crypto")) {
            const tokenMatch = txt.match(tokenMatchRegex);
            if (tokenMatch && tokenMatch[2] !== undefined) {
                const token = tokenMatch[1];
                const tokenDetails = Object.values($cryptoLookup).find(
                    (t) => t.symbol.toLowerCase() === token,
                );
                if (tokenDetails !== undefined) {
                    dispatch("tokenTransfer", {
                        ledger: tokenDetails.ledger,
                        amount: client.validateTokenInput(tokenMatch[2], tokenDetails.decimals)
                            .amount,
                    });
                }
                return true;
            }
        }

        return false;
    }

    function cancelEdit() {
        dispatch("cancelEditEvent");
    }

    function sendMessage() {
        const txt = inp.innerText?.trim();

        if (!parseCommands(txt)) {
            dispatch("sendMessage", expandMentions(txt));
        }
        inp.textContent = "";
        dispatch("setTextContent", undefined);

        messageActions?.close();
        dispatch("stopTyping");

        // After sending a message we must force a new textbox instance to be created, otherwise on iPhone the
        // predictive text doesn't notice the text has been cleared so the suggestions don't make sense.
        textboxId = Symbol();
        tick().then(() => inp.focus());
    }

    export function saveSelection() {
        try {
            // seeing errors in the logs to do with this
            selectedRange = window.getSelection()?.getRangeAt(0);
        } catch (_err) {}
    }

    function restoreSelection() {
        inp.focus();
        if (!selectedRange || !selectedRange.intersectsNode(inp)) {
            const range = new Range();
            range.selectNodeContents(inp);
            range.collapse(false);
            selectedRange = range;
        }

        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(selectedRange);
    }

    function setCaretToEnd() {
        const range = document.createRange();
        range.selectNodeContents(inp);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function setCaretTo(pos: number) {
        const range = document.createRange();
        range.selectNodeContents(inp);
        range.setStart(inp.childNodes[0], pos);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    function onDrop(e: DragEvent) {
        dragging = false;
        dispatch("drop", e);
    }

    function replaceTextWith(replacement: string) {
        if (rangeToReplace === undefined) return;

        const start = rangeToReplace[0];

        const replaced = `${inp.textContent?.slice(
            0,
            rangeToReplace[0],
        )}${replacement} ${inp.textContent?.slice(rangeToReplace[1])}`;
        inp.textContent = replaced;

        dispatch("setTextContent", inp.textContent || undefined);

        tick().then(() => {
            setCaretTo(start + replacement.length);
        });

        rangeToReplace = undefined;
    }

    function mention(ev: CustomEvent<UserOrUserGroup>): void {
        const userOrGroup = ev.detail;
        const username = client.userOrUserGroupName(userOrGroup);
        const userLabel = `@${username}`;

        replaceTextWith(userLabel);

        showMentionPicker = false;
    }

    function cancelMention() {
        showMentionPicker = false;
        setCaretToEnd();
    }

    function completeEmoji(ev: CustomEvent<string>) {
        replaceTextWith(ev.detail);
        showEmojiSearch = false;
    }
</script>

{#if showMentionPicker}
    <MentionPicker
        supportsUserGroups
        offset={messageEntryHeight}
        on:close={cancelMention}
        on:mention={mention}
        prefix={mentionPrefix} />
{/if}

{#if showEmojiSearch}
    <EmojiAutocompleter
        offset={messageEntryHeight}
        on:close={() => (showEmojiSearch = false)}
        on:select={completeEmoji}
        query={emojiQuery} />
{/if}

<div
    class="message-entry"
    class:editing={editingEvent !== undefined}
    bind:clientHeight={messageEntryHeight}>
    {#if blocked}
        <div class="blocked">
            {$_("userIsBlocked")}
        </div>
    {:else if preview && chat.kind !== "direct_chat"}
        <PreviewFooter {joining} {chat} on:joinGroup on:upgrade />
    {:else if !canSendAny}
        <div class="disabled">
            {mode === "thread" ? $_("readOnlyThread") : $_("readOnlyChat")}
        </div>
    {:else}
        {#if recording}
            <div class="recording">
                <Progress percent={percentRecorded} />
            </div>
        {/if}
        {#if canEnterText}
            {#key textboxId}
                <div
                    data-gram="false"
                    data-gramm_editor="false"
                    data-enable-grammarly="false"
                    tabindex={0}
                    bind:this={inp}
                    on:blur={saveSelection}
                    class="textbox"
                    class:recording
                    class:dragging
                    contenteditable
                    on:paste
                    {placeholder}
                    spellcheck
                    on:dragover={() => (dragging = true)}
                    on:dragenter={() => (dragging = true)}
                    on:dragleave={() => (dragging = false)}
                    on:drop={onDrop}
                    on:input={onInput}
                    on:keypress={keyPress} />
            {/key}
        {:else}
            <div class="textbox light">
                {placeholder}
            </div>
        {/if}

        <div class="icons">
            {#if editingEvent === undefined}
                {#if permittedMessages.get("audio") && messageIsEmpty && audioMimeType !== undefined && audioSupported}
                    <div class="record">
                        <AudioAttacher
                            mimeType={audioMimeType}
                            bind:percentRecorded
                            bind:recording
                            bind:supported={audioSupported}
                            on:audioCaptured />
                    </div>
                {:else if canEnterText}
                    <div class="send" on:click={sendMessage}>
                        <HoverIcon title={$_("sendMessage")}>
                            <Send size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </div>
                {/if}
                <!-- we might need this if we are editing too -->
                <MessageActions
                    bind:this={messageActions}
                    bind:messageAction
                    {permittedMessages}
                    {attachment}
                    {mode}
                    editing={editingEvent !== undefined}
                    on:tokenTransfer
                    on:createPrizeMessage
                    on:attachGif
                    on:makeMeme
                    on:createPoll
                    on:upgrade
                    on:clearAttachment
                    on:fileSelected />
            {:else}
                <div class="send" on:click={sendMessage}>
                    <HoverIcon>
                        <ContentSaveEditOutline size={$iconSize} color={"var(--button-txt)"} />
                    </HoverIcon>
                </div>
                <div class="send" on:click={cancelEdit}>
                    <HoverIcon>
                        <Close size={$iconSize} color={"var(--button-txt)"} />
                    </HoverIcon>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    .message-entry {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--entry-bg);
        padding: $sp3;
        border-top: var(--bw) solid var(--bd);
        min-height: toRem(60);

        &.editing {
            background-color: var(--button-bg);
        }

        .icons {
            display: flex;
            align-self: flex-end;
        }
    }
    .send {
        flex: 0 0 15px;
    }
    .textbox {
        flex: 1;
        margin: 0 $sp3;
        padding: toRem(12) $sp4 $sp3 $sp4;
        background-color: var(--entry-input-bg);
        border-radius: var(--entry-input-rd);
        outline: none;
        border: 0;
        max-height: calc(var(--vh, 1vh) * 50);
        min-height: toRem(30);
        overflow-x: hidden;
        overflow-y: auto;
        user-select: text;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: var(--bw) solid var(--entry-input-bd);
        box-shadow: var(--entry-input-sh);

        &:empty:before {
            content: attr(placeholder);
            color: var(--placeholder);
            pointer-events: none;
            display: block; /* For Firefox */
        }

        &.dragging {
            border: var(--bw) dashed var(--txt);
        }

        &.recording {
            display: none;
        }

        &.light {
            color: var(--txt-light);
        }
    }

    .blocked,
    .disabled {
        height: 42px;
        color: var(--txt);
        @include font(book, normal, fs-100);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .recording {
        padding: 0 $sp3;
        flex: auto;
    }
</style>
