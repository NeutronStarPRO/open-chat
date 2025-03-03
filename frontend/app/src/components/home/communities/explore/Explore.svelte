<script lang="ts">
    import CloudOffOutline from "svelte-material-icons/CloudOffOutline.svelte";
    import Tune from "svelte-material-icons/Tune.svelte";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import CommunityCard from "./CommunityCard.svelte";
    import Search from "../../..//Search.svelte";
    import {
        ipadWidth,
        mobileWidth,
        screenWidth,
        ScreenWidth,
    } from "../../../../stores/screenDimensions";
    import { iconSize } from "../../../../stores/iconSize";
    import type { CommunityMatch, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import { pushRightPanelHistory } from "../../../../stores/rightPanel";
    import { communityFiltersStore } from "../../../../stores/communityFilters";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { derived } from "svelte/store";
    import CommunityCardLink from "./CommunityCardLink.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let searchTerm = "";
    let searching = false;
    let searchResults: CommunityMatch[] = [];
    let total = 0;
    let pageIndex = 0;

    $: anonUser = client.anonUser;
    $: pageSize = calculatePageSize($screenWidth);
    $: more = total > searchResults.length;
    $: isDiamond = client.isDiamond;
    $: loading = searching && searchResults.length === 0;
    $: offlineStore = client.offlineStore;

    let filters = derived(
        [communityFiltersStore, client.moderationFlags],
        ([communityFilters, flags]) => {
            return {
                languages: Array.from(communityFilters.languages),
                flags,
            };
        }
    );

    function calculatePageSize(width: ScreenWidth): number {
        // make sure we get even rows of results
        switch (width) {
            case ScreenWidth.Large:
            case ScreenWidth.ExtraLarge:
                return 30;
            default:
                return 32;
        }
    }

    function createCommunity() {
        if ($anonUser) {
            client.identityState.set({ kind: "logging_in" });
            return;
        }
        if (!$isDiamond) {
            dispatch("upgrade");
        } else {
            dispatch("createCommunity");
        }
    }

    function search(reset = false) {
        searching = true;
        if (reset) {
            pageIndex = 0;
        } else {
            pageIndex += 1;
        }

        client
            .exploreCommunities(
                searchTerm === "" ? undefined : searchTerm,
                pageIndex,
                pageSize,
                $filters.flags ?? 0,
                $filters.languages
            )
            .then((results) => {
                if (results.kind === "success") {
                    if (reset) {
                        searchResults = results.matches;
                    } else {
                        searchResults = [...searchResults, ...results.matches];
                    }
                    total = results.total;
                }
            })
            .finally(() => (searching = false));
    }

    function showFilters() {
        pushRightPanelHistory({ kind: "community_filters" });
    }

    onMount(() => {
        return filters.subscribe((_) => {
            search(true);
        });
    });
</script>

<div class="explore">
    <div class="header">
        <div class="title-row">
            <div class="title">
                {#if $mobileWidth}
                    <h4>{$_("communities.exploreMobile")}</h4>
                {:else}
                    <h4>{$_("communities.explore")}</h4>
                {/if}
            </div>
            {#if !$ipadWidth}
                <div class="search">
                    <Search
                        fill
                        bind:searchTerm
                        searching={false}
                        on:searchEntered={() => search(true)}
                        placeholder={$_("communities.search")} />
                </div>
                <div class="create">
                    <Button on:click={createCommunity} hollow>{$_("communities.create")}</Button>
                </div>
            {/if}
            <div class="buttons">
                {#if $ipadWidth}
                    <HoverIcon on:click={createCommunity}>
                        <Plus size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/if}

                <HoverIcon title={$_("showFilters")} on:click={showFilters}>
                    <Tune size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        </div>
        <div class="subtitle-row">
            {#if $ipadWidth}
                <div class="search">
                    <Search
                        searching={false}
                        fill
                        bind:searchTerm
                        on:searchEntered={() => search(true)}
                        placeholder={$_("communities.search")} />
                </div>
            {/if}
        </div>
    </div>

    <div class="communities-wrapper">
        <div class="communities" class:loading class:empty={searchResults.length === 0}>
            {#if loading}
                <div class="loading">
                    <FancyLoader />
                </div>
            {:else if searchResults.length === 0}
                {#if $offlineStore}
                    <div class="no-match">
                        <CloudOffOutline size={"1.8em"} color={"var(--txt-light)"} />
                        <p class="sub-header">{$_("offlineError")}</p>
                    </div>
                {:else}
                    <div class="no-match">
                        <h4 class="header">{$_("communities.noMatch")}</h4>
                        <p class="sub-header">{$_("communities.refineSearch")}</p>
                    </div>
                {/if}
            {:else}
                {#each searchResults as community (community.id.communityId)}
                    <CommunityCardLink url={`/community/${community.id.communityId}`}>
                        <CommunityCard
                            id={community.id.communityId}
                            name={community.name}
                            description={community.description}
                            avatar={community.avatar}
                            banner={community.banner}
                            memberCount={community.memberCount}
                            channelCount={community.channelCount}
                            gate={community.gate}
                            language={community.primaryLanguage}
                            flags={community.flags} />
                    </CommunityCardLink>
                {/each}
            {/if}
        </div>
        {#if more}
            <div class="more">
                <Button disabled={searching} loading={searching} on:click={() => search(false)}
                    >{$_("communities.loadMore")}</Button>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .explore {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: $sp5;
        height: 100%;
        overflow: hidden;

        @include mobile() {
            padding: $sp3;
            gap: $sp3;
        }
    }

    .header {
        .title-row {
            display: flex;
            align-items: center;
            gap: $sp4;
            margin-bottom: $sp5;

            @include size-below(lg) {
                margin-bottom: $sp3;
                justify-content: space-between;
            }

            .title {
                display: flex;
                gap: $sp3;
                align-items: center;

                h4 {
                    @include font(bold, normal, fs-160, 38);
                    flex: auto;

                    @include mobile() {
                        @include font(bold, normal, fs-140, 38);
                    }
                }
            }

            .search {
                flex: auto;
            }

            .buttons {
                display: flex;
                align-items: center;
                justify-content: flex-end;
            }
        }

        .subtitle-row {
            display: flex;
            justify-content: space-between;
            gap: $sp4;

            @include size-below(lg) {
                flex-direction: column;
            }
        }
    }

    .communities-wrapper {
        @include nice-scrollbar();
        flex: auto;
    }

    .communities {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-gap: $sp5;
        margin-bottom: $sp5;

        @include size-below(xxl) {
            grid-gap: $sp4;
        }

        @include size-below(xl) {
            grid-template-columns: repeat(3, 1fr);
        }

        @include size-below(md) {
            grid-template-columns: repeat(2, 1fr);
        }

        @include size-below(sm) {
            grid-template-columns: repeat(1, 1fr);
        }

        &.loading,
        &.empty {
            height: 100%;
            grid-template-columns: repeat(1, 1fr);
            margin-bottom: 0;
        }
    }

    .more {
        text-align: center;
    }

    $size: 200px;

    .loading {
        width: $size;
        margin: auto;
    }

    .no-match {
        .header {
            @include font(bold, normal, fs-160, 38);
        }
        .sub-header {
            @include font(book, normal, fs-100, 38);
            color: var(--txt-light);
        }
        margin: auto;
        text-align: center;
    }
</style>
