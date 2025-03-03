<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Button from "../../Button.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import GroupDetails from "./GroupDetails.svelte";
    import RulesEditor from "../RulesEditor.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import { toastStore } from "../../../stores/toast";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ChooseMembers from "../ChooseMembers.svelte";
    import {
        type CandidateGroupChat,
        type CreateGroupResponse,
        type OpenChat,
        UnsupportedValueError,
        type UpdateGroupResponse,
        routeForChatIdentifier,
        chatIdentifierUnset,
        type MultiUserChatIdentifier,
        type UserSummary,
        type Level,
    } from "openchat-client";
    import StageHeader from "../StageHeader.svelte";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import page from "page";
    import AreYouSure from "../../AreYouSure.svelte";
    import VisibilityControl from "../VisibilityControl.svelte";
    import { interpolateLevel } from "../../../utils/i18n";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let candidateGroup: CandidateGroupChat;

    let confirming = false;
    let busy = false;
    let step = 0;
    let actualWidth = 0;
    let detailsValid = true;
    let visibilityValid = true;
    let originalGroup = structuredClone(candidateGroup);
    let rulesValid = true;
    $: steps = getSteps(editing, detailsValid, visibilityValid, rulesValid, hideInviteUsers);
    $: editing = !chatIdentifierUnset(candidateGroup.id);
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: canEditPermissions = !editing ? true : client.canChangePermissions(candidateGroup.id);
    $: canEditDisappearingMessages = !editing
        ? true
        : client.hasOwnerRights(candidateGroup.membership.role);
    $: selectedCommunity = client.selectedCommunity;

    $: permissionsDirty = client.haveGroupPermissionsChanged(
        originalGroup.permissions,
        candidateGroup.permissions,
    );
    $: rulesDirty =
        editing &&
        candidateGroup.rules !== undefined &&
        (candidateGroup.rules.enabled !== originalGroup.rules.enabled ||
            candidateGroup.rules.text !== originalGroup.rules.text);
    $: nameDirty = editing && candidateGroup.name !== originalGroup.name;
    $: descDirty = editing && candidateGroup.description !== originalGroup.description;
    $: avatarDirty = editing && candidateGroup.avatar?.blobUrl !== originalGroup.avatar?.blobUrl;
    $: visDirty = editing && candidateGroup.public !== originalGroup.public;
    $: infoDirty = nameDirty || descDirty || avatarDirty;
    $: gateDirty = editing && client.hasAccessGateChanged(candidateGroup.gate, originalGroup.gate);
    $: ttlDirty = editing && candidateGroup.eventsTTL !== originalGroup.eventsTTL;
    $: dirty = infoDirty || rulesDirty || permissionsDirty || visDirty || gateDirty || ttlDirty;
    $: chatListScope = client.chatListScope;
    $: hideInviteUsers = candidateGroup.level === "channel" && candidateGroup.public;
    $: valid = detailsValid && visibilityValid && rulesValid;

    function getSteps(
        editing: boolean,
        detailsValid: boolean,
        visibilityValid: boolean,
        rulesValid: boolean,
        hideInviteUsers: boolean,
    ) {
        let steps = [
            { labelKey: "group.details", valid: detailsValid },
            { labelKey: "access.visibility", valid: visibilityValid },
            { labelKey: $_("rules.rules"), valid: rulesValid },
            { labelKey: "permissions.permissions", valid: true },
        ];

        if (!editing && !hideInviteUsers) {
            steps.push({ labelKey: "invite.invite", valid: true });
        }
        return steps;
    }

    function searchUsers(term: string): Promise<UserSummary[]> {
        const canInvite =
            $selectedCommunity === undefined || client.canInviteUsers($selectedCommunity.id);
        return client.searchUsersForInvite(term, 20, candidateGroup.level, true, canInvite);
    }

    function interpolateError(error: string, level: Level): string {
        return interpolateLevel(error, level, true);
    }

    function groupUpdateErrorMessage(resp: UpdateGroupResponse, level: Level): string | undefined {
        if (resp.kind === "success") return undefined;
        if (resp.kind === "unchanged") return undefined;
        if (resp.kind === "name_too_short") return "groupNameTooShort";
        if (resp.kind === "name_too_long") return "groupNameTooLong";
        if (resp.kind === "name_reserved") return "groupNameReserved";
        if (resp.kind === "desc_too_long") return "groupDescTooLong";
        if (resp.kind === "name_taken" && level === "group") return "groupAlreadyExists";
        if (resp.kind === "name_taken") return "channelAlreadyExists";
        if (resp.kind === "not_in_group") return "userNotInGroup";
        if (resp.kind === "internal_error") return "groupUpdateFailed";
        if (resp.kind === "not_authorized") return "groupUpdateFailed";
        if (resp.kind === "avatar_too_big") return "avatarTooBig";
        if (resp.kind === "rules_too_short") return "groupRulesTooShort";
        if (resp.kind === "rules_too_long") return "groupRulesTooLong";
        if (resp.kind === "user_suspended") return "userSuspended";
        if (resp.kind === "chat_frozen") return "chatFrozen";
        if (resp.kind === "failure") return "failure";
        if (resp.kind === "offline") return "offlineError";
        throw new UnsupportedValueError(`Unexpected UpdateGroupResponse type received`, resp);
    }

    function groupCreationErrorMessage(
        resp: CreateGroupResponse,
        level: Level,
    ): string | undefined {
        if (resp.kind === "success") return undefined;
        if (resp.kind === "offline") return "offlineError";
        if (resp.kind === "internal_error") return "groupCreationFailed";
        if (resp.kind === "name_too_short") return "groupNameTooShort";
        if (resp.kind === "name_too_long") return "groupNameTooLong";
        if (resp.kind === "name_reserved") return "groupNameReserved";
        if (resp.kind === "description_too_long") return "groupDescTooLong";
        if (resp.kind === "group_name_taken" && level === "group") return "groupAlreadyExists";
        if (resp.kind === "group_name_taken") return "channelAlreadyExists";
        if (resp.kind === "avatar_too_big") return "groupAvatarTooBig";
        if (resp.kind === "max_groups_created") return "maxGroupsCreated";
        if (resp.kind === "throttled") return "groupCreationFailed";
        if (resp.kind === "rules_too_short") return "groupRulesTooShort";
        if (resp.kind === "rules_too_long") return "groupRulesTooLong";
        if (resp.kind === "user_suspended") return "userSuspended";
        if (resp.kind === "default_must_be_public") return "defaultMustBePublic";
        if (resp.kind === "unauthorized_to_create_public_group")
            return "unauthorizedToCreatePublicGroup";
        return "groupCreationFailed";
    }

    function optionallyInviteUsers(chatId: MultiUserChatIdentifier): Promise<void> {
        if (candidateGroup.members.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                chatId,
                candidateGroup.members.map((m) => m.user.userId),
            )
            .then((resp) => {
                if (resp !== "success") {
                    Promise.reject("Unable to invite users to the new group");
                }
            });
    }

    function updateGroup(yes: boolean = true): Promise<void> {
        busy = true;

        const changeVisibility = visDirty && candidateGroup.public !== originalGroup.public;

        if (changeVisibility && !confirming) {
            confirming = true;
            return Promise.resolve();
        }

        if (changeVisibility && confirming && !yes) {
            confirming = false;
            busy = false;
            return Promise.resolve();
        }

        confirming = false;

        const updatedGroup = { ...candidateGroup };

        return client
            .updateGroup(
                updatedGroup.id,
                nameDirty ? updatedGroup.name : undefined,
                descDirty ? updatedGroup.description : undefined,
                rulesDirty && rulesValid ? updatedGroup.rules : undefined,
                permissionsDirty
                    ? client.diffGroupPermissions(
                          originalGroup.permissions,
                          updatedGroup.permissions,
                      )
                    : undefined,
                avatarDirty ? updatedGroup.avatar?.blobData : undefined,
                ttlDirty
                    ? updatedGroup.eventsTTL === undefined
                        ? "set_to_none"
                        : { value: updatedGroup.eventsTTL }
                    : undefined,
                gateDirty ? updatedGroup.gate : undefined,
                visDirty ? updatedGroup.public : undefined,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    originalGroup = updatedGroup;
                } else {
                    const err = groupUpdateErrorMessage(resp, updatedGroup.level);
                    if (err) {
                        toastStore.showFailureToast(interpolateError(err, updatedGroup.level));
                    }
                }
            })
            .finally(() => {
                busy = false;
                dispatch("close");
            });
    }

    function createGroup() {
        busy = true;

        const level = candidateGroup.level;

        client
            .createGroupChat(candidateGroup)
            .then((resp) => {
                if (resp.kind !== "success") {
                    const err = groupCreationErrorMessage(resp, level);
                    if (err) toastStore.showFailureToast(interpolateError(err, level));
                    step = 0;
                } else if (!hideInviteUsers) {
                    return optionallyInviteUsers(resp.canisterId)
                        .then(() => {
                            onGroupCreated(resp.canisterId);
                        })
                        .catch((_err) => {
                            toastStore.showFailureToast("inviteUsersFailed");
                            step = 0;
                        });
                } else {
                    onGroupCreated(resp.canisterId);
                }
            })
            .catch((_err) => {
                toastStore.showFailureToast("groupCreationFailed");
                step = 0;
            })
            .finally(() => (busy = false));
    }

    function onGroupCreated(canisterId: MultiUserChatIdentifier) {
        const url = routeForChatIdentifier($chatListScope.kind, canisterId);
        dispatch("groupCreated", {
            chatId: canisterId,
            public: candidateGroup.public,
            rules: candidateGroup.rules,
        });
        dispatch("close");

        // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
        tick().then(() => page(url)); // trigger the selection of the chat
    }

    function changeStep(ev: CustomEvent<number>) {
        step = ev.detail;
    }
</script>

{#if confirming}
    <AreYouSure
        message={interpolateLevel(
            `confirmMakeGroup${candidateGroup.public ? "Public" : "Private"}`,
            candidateGroup.level,
            true,
        )}
        action={updateGroup} />
{/if}

<ModalContent bind:actualWidth closeIcon on:close>
    <div class="header" slot="header">
        {editing
            ? interpolateLevel("group.edit", candidateGroup.level, true)
            : interpolateLevel("group.createTitle", candidateGroup.level, true)}
    </div>
    <div class="body" slot="body">
        <StageHeader {steps} enabled on:step={changeStep} {step} />
        <div class="wrapper">
            <div class="sections" style={`left: -${left}px`}>
                <div class="details" class:visible={step === 0}>
                    <GroupDetails bind:valid={detailsValid} {busy} bind:candidateGroup />
                </div>
                <div class="visibility" class:visible={step === 1}>
                    <VisibilityControl
                        on:upgrade
                        original={originalGroup}
                        {editing}
                        history
                        {canEditDisappearingMessages}
                        bind:valid={visibilityValid}
                        bind:candidate={candidateGroup} />
                </div>
                <div class="rules" class:visible={step === 2}>
                    <RulesEditor
                        bind:valid={rulesValid}
                        level={candidateGroup.level}
                        bind:rules={candidateGroup.rules}
                        {editing} />
                </div>
                <div use:menuCloser class="permissions" class:visible={step === 3}>
                    {#if canEditPermissions}
                        <GroupPermissionsEditor
                            bind:permissions={candidateGroup.permissions}
                            isPublic={candidateGroup.public}
                            isCommunityPublic={$selectedCommunity?.public ?? true} />
                    {:else}
                        <GroupPermissionsViewer
                            bind:permissions={candidateGroup.permissions}
                            isPublic={candidateGroup.public} />
                    {/if}
                </div>
                {#if !editing && !hideInviteUsers}
                    <div class="members" class:visible={step === 4}>
                        <ChooseMembers
                            userLookup={searchUsers}
                            bind:members={candidateGroup.members}
                            {busy} />
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        <div class="group-buttons">
            <div class="back">
                {#if !editing && step > 0}
                    <Button
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step - 1)}>{$_("group.back")}</Button>
                {/if}
            </div>
            <div class="actions">
                <Button
                    disabled={false}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => dispatch("close")}
                    secondary>{$_("cancel")}</Button>

                {#if editing}
                    <Button
                        disabled={!dirty || busy || !valid}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => updateGroup()}
                        >{interpolateLevel("group.update", candidateGroup.level, true)}</Button>
                {:else if step < steps.length - 1}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step + 1)}>
                        {$_("group.next")}
                    </Button>
                {:else}
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={createGroup}
                        >{interpolateLevel("group.create", candidateGroup.level, true)}</Button>
                {/if}
            </div>
        </div>
    </span>
</ModalContent>

<style lang="scss">
    :global(.group-buttons button:not(.loading)) {
        @include mobile() {
            min-width: 0 !important;
        }
    }

    :global(.group-buttons .actions button) {
        height: auto;
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .group-buttons {
        display: flex;
        justify-content: space-between;
        width: 100%;
        gap: $sp3;

        .back {
            display: flex;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: $sp3;
        }
    }

    .wrapper {
        width: 100%;
        overflow: hidden;
        height: 550px;
        position: relative;

        @include mobile() {
            height: 400px;
        }
    }

    .sections {
        display: flex;
        transition: left 250ms ease-in-out;
        position: relative;
        gap: $sp5;
        height: 100%;
        @include mobile() {
            gap: $sp4;
        }
    }

    .details,
    .visibility,
    .rules,
    .members,
    .permissions {
        flex: 0 0 100%;
        visibility: hidden;
        transition: visibility 250ms ease-in-out;
        @include nice-scrollbar();

        &.visible {
            visibility: visible;
        }
    }
</style>
