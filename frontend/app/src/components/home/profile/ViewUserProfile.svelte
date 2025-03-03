<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import Markdown from "../Markdown.svelte";
    import {
        AvatarSize,
        type UserSummary,
        type PublicProfile,
        type ChatSummary,
        type CommunitySummary,
        type OpenChat,
    } from "openchat-client";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { rightPanelHistory } from "../../../stores/rightPanel";
    import { toastStore } from "../../../stores/toast";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let userId: string;
    export let alignTo: DOMRect | undefined = undefined;
    export let chatButton = true;
    export let inGlobalContext = false;

    let profile: PublicProfile | undefined = undefined;
    let user: UserSummary | undefined;
    let lastOnline: number | undefined;

    $: createdUser = client.user;
    $: platformModerator = client.platformModerator;
    $: me = userId === $createdUser.userId;
    $: isSuspended = user?.suspended ?? false;
    $: modal = $mobileWidth;
    $: status =
        lastOnline !== undefined && lastOnline !== 0
            ? client.formatLastOnlineDate($_, Date.now(), lastOnline)
            : "";
    $: avatarUrl =
        profile !== undefined
            ? client.buildUserAvatarUrl(process.env.BLOB_URL_PATTERN!, userId, profile.avatarId)
            : "/assets/unknownUserAvatar.svg";
    $: joined =
        profile !== undefined ? `${$_("joined")} ${formatDate(profile.created)}` : undefined;
    $: isPremium = profile?.isPremium ?? false;
    $: diamond = user?.diamond ?? false;
    $: phoneIsVerified = profile?.phoneIsVerified ?? false;
    $: selectedChat = client.selectedChatStore;
    $: blockedUsers = client.blockedUsers;
    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: currentCommunityBlockedUsers = client.currentCommunityBlockedUsers;
    $: selectedCommunity = client.selectedCommunity;
    $: communityMembers = client.currentCommunityMembers;
    $: displayName = client.getDisplayName(
        {
            userId,
            username: profile?.username ?? "",
            displayName: profile?.displayName,
        },
        inGlobalContext ? undefined : $communityMembers
    );
    $: canBlock = canBlockUser(
        $selectedChat,
        $selectedCommunity,
        $blockedUsers,
        $currentChatBlockedUsers,
        $currentCommunityBlockedUsers
    );
    $: canUnblock = canUnblockUser(
        $selectedChat,
        $selectedCommunity,
        $blockedUsers,
        $currentChatBlockedUsers,
        $currentCommunityBlockedUsers
    );

    onMount(async () => {
        try {
            const task1 = client.getPublicProfile(userId);
            const task2 = client.getUser(userId);
            lastOnline = await client.getLastOnlineDate(userId, Date.now());
            user = await task2;
            profile = await task1;
        } catch (e: any) {
            client.logError("Failed to load user profile", e);
            onClose();
        }
    });

    function afterBlock(result: boolean, success: string, failure: string) {
        if (!result) {
            toastStore.showFailureToast(failure);
        } else {
            toastStore.showSuccessToast(success);
        }
    }

    function blockUser() {
        if ($selectedChat !== undefined) {
            if ($selectedChat.kind === "direct_chat") {
                client.blockUserFromDirectChat($selectedChat.them.userId).then((success) => {
                    afterBlock(success, "blockUserSucceeded", "blockUserFailed");
                });
                onClose();
                return;
            }
            if ($selectedChat.kind === "group_chat") {
                client.blockUser($selectedChat.id, userId).then((success) => {
                    afterBlock(success, "blockUserSucceeded", "blockUserFailed");
                });
                onClose();
                return;
            }
        }
        if ($selectedCommunity !== undefined) {
            client
                .blockCommunityUser($selectedCommunity.id, userId)
                .then((success) => afterBlock(success, "blockUserSucceeded", "blockUserFailed"));
            onClose();
            return;
        }
    }

    function unblockUser() {
        if ($selectedChat !== undefined) {
            if ($selectedChat.kind === "direct_chat") {
                client.unblockUserFromDirectChat($selectedChat.them.userId).then((success) => {
                    afterBlock(success, "unblockUserSucceeded", "unblockUserFailed");
                });
                onClose();
                return;
            }
            if ($selectedChat.kind === "group_chat") {
                client.unblockUser($selectedChat.id, userId).then((success) => {
                    afterBlock(success, "unblockUserSucceeded", "unblockUserFailed");
                });
                onClose();
                return;
            }
        }
        if ($selectedCommunity !== undefined) {
            client
                .unblockCommunityUser($selectedCommunity.id, userId)
                .then((success) =>
                    afterBlock(success, "unblockUserSucceeded", "unblockUserFailed")
                );
            onClose();
            return;
        }
    }

    function canBlockUser(
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
        blockedUsers: Set<string>,
        blockedChatUsers: Set<string>,
        blockedCommunityUsers: Set<string>
    ) {
        if (me || inGlobalContext) return false;

        if (chat !== undefined) {
            if (chat.kind === "direct_chat") return !blockedUsers.has(userId);
            if (chat.kind === "group_chat")
                return !blockedChatUsers.has(userId) && client.canBlockUsers(chat.id);
        }
        if (community !== undefined) {
            return !blockedCommunityUsers.has(userId) && client.canBlockUsers(community.id);
        }
        return false;
    }

    function canUnblockUser(
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
        blockedUsers: Set<string>,
        blockedChatUsers: Set<string>,
        blockedCommunityUsers: Set<string>
    ) {
        if (me || inGlobalContext) return false;
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") return blockedUsers.has(userId);
            if (chat.kind === "group_chat")
                return blockedChatUsers.has(userId) && client.canBlockUsers(chat.id);
        }
        if (community !== undefined) {
            return blockedCommunityUsers.has(userId) && client.canBlockUsers(community.id);
        }
        return false;
    }

    function handleOpenDirectChat() {
        dispatch("openDirectChat");
    }

    function showUserProfile() {
        rightPanelHistory.set([{ kind: "user_profile" }]);
        onClose();
    }

    function onClose() {
        dispatch("close");
    }

    function onWindowResize() {
        if (!modal) {
            onClose();
        }
    }

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
        });
    }
</script>

<svelte:window on:resize={onWindowResize} />

{#if profile !== undefined}
    <Overlay dismissible on:close={onClose}>
        <ModalContent
            closeIcon
            fill
            square
            compactFooter
            hideFooter={!me && !chatButton && !canBlock && !canUnblock}
            fixedWidth={false}
            large={modal}
            {alignTo}
            on:close>
            <div class="header" slot="header">
                <div class="handle">
                    <span class:diamond>
                        {displayName}
                    </span>
                    <span class="username">
                        @{profile.username}
                    </span>
                </div>
            </div>
            <div slot="body" class="body" class:modal>
                <div class="avatar">
                    <Avatar url={avatarUrl} {userId} size={AvatarSize.Large} />
                </div>
                {#if profile.bio.length > 0}
                    <p class="bio"><Markdown text={profile.bio} /></p>
                {/if}
                <div class="meta">
                    <div class="left" class:suspended={isSuspended}>
                        {#if isSuspended}
                            {$_("accountSuspended")}
                        {:else}
                            {status === "" ? "..." : status}
                        {/if}
                    </div>
                    <div class="right">
                        {joined}
                    </div>
                    {#if $platformModerator}
                        {#if isPremium}
                            <p class="left">PREMIUM</p>
                        {/if}
                        {#if phoneIsVerified}
                            <p class="right">VERIFIED</p>
                        {/if}
                    {/if}
                </div>
            </div>
            <div slot="footer" class="footer">
                <ButtonGroup align={"fill"}>
                    {#if chatButton && !me}
                        <Button on:click={handleOpenDirectChat} small>{$_("profile.chat")}</Button>
                    {/if}
                    {#if me}
                        <Button on:click={showUserProfile} small>{$_("profile.settings")}</Button>
                    {/if}
                    {#if canBlock}
                        <Button on:click={blockUser} small>{$_("profile.block")}</Button>
                    {/if}
                    {#if canUnblock}
                        <Button on:click={unblockUser} small>{$_("profile.unblock")}</Button>
                    {/if}
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .body {
        position: relative;
        display: flex;
        flex-direction: column;
        @include font-size(fs-90);
        word-wrap: break-word;
        width: 320px;
        padding: $sp4 $sp5 0 $sp5;

        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }

        .avatar {
            padding: 0 0 $sp4 0;
        }

        .bio {
            max-height: 180px;
            overflow-y: auto;
            @include font(book, normal, fs-80, 20);
            @include nice-scrollbar();
            color: var(--txt-light);
            margin-bottom: $sp3;
            width: 100%;
        }

        &.modal {
            width: 100%;
        }

        .meta {
            @include font(light, normal, fs-60);
            padding: 12px 0;
            margin-top: $sp2;
            border-top: 1px solid var(--bd);
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: $sp3;

            .left {
                justify-self: flex-start;
            }

            .right {
                justify-self: flex-end;
            }

            @include mobile() {
                .left,
                .right {
                    @include font(light, normal, fs-80);
                    justify-self: center;
                }
            }

            .suspended {
                color: var(--menu-warn);
            }
        }
    }

    .header {
        @include font(bold, normal, fs-100, 21);
        width: 250px;

        .handle {
            display: inline;
            overflow-wrap: anywhere;

            .diamond {
                @include diamond();
            }

            .username {
                font-weight: 200;
                color: var(--txt-light);
            }
        }
    }
</style>
