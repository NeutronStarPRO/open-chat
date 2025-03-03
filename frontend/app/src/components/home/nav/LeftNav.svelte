<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import Panel from "../../Panel.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import ArrowRight from "svelte-material-icons/ArrowExpandRight.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import {
        AvatarSize,
        type CommunitySummary,
        type OpenChat,
        type UserSummary,
        emptyCombinedUnreadCounts,
    } from "openchat-client";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { _ } from "svelte-i18n";
    import { pathParams } from "../../../routes";
    import page from "page";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import LeftNavItem from "./LeftNavItem.svelte";
    import MainMenu from "./MainMenu.svelte";
    import { navOpen } from "../../../stores/layout";
    import { flip } from "svelte/animate";
    import { type DndEvent, dndzone } from "svelte-dnd-action";
    import { isTouchDevice } from "../../../utils/devices";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const flipDurationMs = 300;

    $: createdUser = client.user;
    $: userStore = client.userStore;
    $: user = $userStore[$createdUser.userId] as UserSummary | undefined; // annoying that this annotation is necessary
    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;
    $: communities = client.communitiesList;
    $: selectedCommunity = client.selectedCommunity;
    $: chatListScope = client.chatListScope;
    $: unreadDirectCounts = client.unreadDirectCounts;
    $: unreadGroupCounts = client.unreadGroupCounts;
    $: unreadFavouriteCounts = client.unreadFavouriteCounts;
    $: unreadCommunityChannelCounts = client.unreadCommunityChannelCounts;
    $: communityExplorer = $pathParams.kind === "communities_route";
    $: anonUser = client.anonUser;
    $: selectedCommunityId = $selectedCommunity?.id.communityId;

    let iconSize = $mobileWidth ? "1.2em" : "1.4em"; // in this case we don't want to use the standard store

    // we don't want drag n drop to monkey around with the key
    type CommunityItem = CommunitySummary & { _id: string };
    let communityItems: CommunityItem[] = [];
    let dragging = false;

    onMount(() => {
        return communities.subscribe(initCommunitiesList);
    });

    function initCommunitiesList(communities: CommunitySummary[]) {
        // we don't want to allow the list to update if we're in the middle of dragging
        if (dragging) return;

        communityItems = communities.map((c) => ({
            ...c,
            _id: c.id.communityId,
        }));
    }

    function reindex(communities: CommunitySummary[]): CommunitySummary[] {
        return communities.map((item, i) => ({
            ...item,
            membership: {
                ...item.membership,
                index: communities.length - i,
            },
        }));
    }

    function handleDndConsider(e: CustomEvent<DndEvent<CommunityItem>>) {
        dragging = true;
        communityItems = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<CommunityItem>>) {
        dragging = false;
        communityItems = e.detail.items;
        client.updateCommunityIndexes(reindex(e.detail.items));
    }

    function toggleNav() {
        if ($navOpen) {
            navOpen.set(false);
        } else {
            navOpen.set(true);
        }
    }

    function viewProfile() {
        dispatch("profile");
    }

    function exploreCommunities() {
        page("/communities");
    }

    function directChats() {
        page("/user");
    }

    function groupChats() {
        page("/group");
    }

    function favouriteChats() {
        page("/favourite");
    }

    function selectCommunity(community: CommunitySummary) {
        page(`/community/${community.id.communityId}`);
    }

    function closeIfOpen() {
        if ($navOpen) {
            navOpen.set(false);
        }
    }
</script>

<svelte:body on:click={closeIfOpen} />

<Panel nav>
    <div class="top">
        <LeftNavItem separator label={$_("communities.mainMenu")}>
            <div class="hover logo">
                <MenuIcon position="right" align="start" gutter={20}>
                    <span slot="icon">
                        <HoverIcon>
                            <Hamburger size={iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                    <span slot="menu">
                        <MainMenu on:wallet on:halloffame on:upgrade on:profile />
                    </span>
                </MenuIcon>
            </div>
        </LeftNavItem>

        {#if user !== undefined}
            <LeftNavItem label={$_("profile.title")} on:click={viewProfile}>
                <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
            </LeftNavItem>
        {/if}

        <LeftNavItem
            selected={$chatListScope.kind === "direct_chat" && !communityExplorer}
            label={$_("communities.directChats")}
            disabled={$anonUser}
            unread={$unreadDirectCounts.chats}
            on:click={directChats}>
            <div class="hover direct">
                <MessageOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem
            selected={$chatListScope.kind === "group_chat" && !communityExplorer}
            label={$_("communities.groupChats")}
            unread={client.mergeCombinedUnreadCounts($unreadGroupCounts)}
            on:click={groupChats}>
            <div class="hover direct">
                <ForumOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem
            selected={$chatListScope.kind === "favourite" && !communityExplorer}
            separator
            disabled={$anonUser}
            label={$_("communities.favourites")}
            unread={client.mergeCombinedUnreadCounts($unreadFavouriteCounts)}
            on:click={favouriteChats}>
            <div class="hover favs">
                <HeartOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>

    <div
        use:dndzone={{
            items: communityItems,
            flipDurationMs,
            dropTargetStyle: { outline: "var(--accent) solid 2px" },
            dragDisabled: isTouchDevice,
        }}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
        class="middle">
        {#each communityItems as community (community._id)}
            <div animate:flip={{ duration: flipDurationMs }}>
                <LeftNavItem
                    selected={community.id.communityId === selectedCommunityId &&
                        $chatListScope.kind !== "favourite" &&
                        !communityExplorer}
                    unread={client.mergeCombinedUnreadCounts(
                        $unreadCommunityChannelCounts.get(community.id) ??
                            emptyCombinedUnreadCounts(),
                    )}
                    label={community.name}
                    on:click={() => selectCommunity(community)}>
                    <Avatar
                        selected={community.id.communityId === selectedCommunityId &&
                            $chatListScope.kind !== "favourite" &&
                            !communityExplorer}
                        url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
                        size={avatarSize} />
                </LeftNavItem>
            </div>
        {/each}
    </div>

    <div class="bottom">
        <LeftNavItem
            selected={communityExplorer}
            label={$_("communities.explore")}
            on:click={exploreCommunities}>
            <div class="explore hover">
                <Compass size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem label={$navOpen ? $_("collapse") : $_("expand")}>
            <div class:open={$navOpen} on:click|stopPropagation={toggleNav} class="expand hover">
                <ArrowRight size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>
</Panel>

<style lang="scss">
    :global(.hover svg path) {
        transition: fill 250ms ease-in-out;
    }

    @media (hover: hover) {
        :global(.left-nav-item .avatar:not(.selected):hover) {
            box-shadow: 0 0 0 1px var(--icon-selected);
        }

        :global(.left-nav-item:hover .hover svg path) {
            fill: var(--icon-selected);
        }

        :global(.left-nav-item:hover .hover) {
            border-color: var(--icon-selected);
        }
    }

    :global(.left-nav-item.selected svg path) {
        fill: var(--icon-selected);
    }

    :global(.left-nav-item.selected) {
        .explore {
            border: 1px solid var(--icon-selected);
        }
    }

    $size: toRem(48);
    $mobile-size: toRem(40);

    .top,
    .bottom,
    .middle {
        display: flex;
        flex-direction: column;
    }
    .logo {
        width: $size;
        height: $size;
        margin: auto;

        @include mobile() {
            width: $mobile-size;
            height: $mobile-size;
        }
    }

    .middle {
        flex: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
    }

    .hover {
        width: $size;
        height: $size;
        border: 1px solid transparent;
        border-radius: var(--nav-icon-rd);
        background: var(--icon-hv);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 250ms ease-in-out;

        @include mobile() {
            width: $mobile-size;
            height: $mobile-size;
        }
    }

    .expand {
        transition: transform 250ms ease-in-out;

        &.open {
            transform: rotate(-180deg);
        }
    }
</style>
