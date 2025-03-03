use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(community, channel_summary_updates, query);
    generate_candid_method!(community, channel_summary, query);
    generate_candid_method!(community, deleted_message, query);
    generate_candid_method!(community, events_by_index, query);
    generate_candid_method!(community, events_window, query);
    generate_candid_method!(community, events, query);
    generate_candid_method!(community, explore_channels, query);
    generate_candid_method!(community, invite_code, query);
    generate_candid_method!(community, local_user_index, query);
    generate_candid_method!(community, messages_by_message_index, query);
    generate_candid_method!(community, search_channel, query);
    generate_candid_method!(community, selected_channel_initial, query);
    generate_candid_method!(community, selected_channel_updates, query);
    generate_candid_method!(community, selected_channel_updates_v2, query);
    generate_candid_method!(community, selected_initial, query);
    generate_candid_method!(community, selected_updates, query);
    generate_candid_method!(community, selected_updates_v2, query);
    generate_candid_method!(community, summary, query);
    generate_candid_method!(community, summary_updates, query);
    generate_candid_method!(community, thread_previews, query);

    generate_candid_method!(community, add_members_to_channel, update);
    generate_candid_method!(community, add_reaction, update);
    generate_candid_method!(community, block_user, update);
    generate_candid_method!(community, change_channel_role, update);
    generate_candid_method!(community, change_role, update);
    generate_candid_method!(community, claim_prize, update);
    generate_candid_method!(community, create_channel, update);
    generate_candid_method!(community, create_user_group, update);
    generate_candid_method!(community, decline_invitation, update);
    generate_candid_method!(community, delete_channel, update);
    generate_candid_method!(community, delete_messages, update);
    generate_candid_method!(community, delete_user_groups, update);
    generate_candid_method!(community, disable_invite_code, update);
    generate_candid_method!(community, edit_message, update);
    generate_candid_method!(community, enable_invite_code, update);
    generate_candid_method!(community, follow_thread, update);
    generate_candid_method!(community, import_group, update);
    generate_candid_method!(community, leave_channel, update);
    generate_candid_method!(community, pin_message, update);
    generate_candid_method!(community, register_poll_vote, update);
    generate_candid_method!(community, register_proposal_vote_v2, update);
    generate_candid_method!(community, register_proposal_vote, update);
    generate_candid_method!(community, remove_member_from_channel, update);
    generate_candid_method!(community, remove_member, update);
    generate_candid_method!(community, remove_reaction, update);
    generate_candid_method!(community, report_message, update);
    generate_candid_method!(community, reset_invite_code, update);
    generate_candid_method!(community, send_message, update);
    generate_candid_method!(community, set_member_display_name, update);
    generate_candid_method!(community, toggle_mute_notifications, update);
    generate_candid_method!(community, unblock_user, update);
    generate_candid_method!(community, undelete_messages, update);
    generate_candid_method!(community, unfollow_thread, update);
    generate_candid_method!(community, unpin_message, update);
    generate_candid_method!(community, update_channel, update);
    generate_candid_method!(community, update_community, update);
    generate_candid_method!(community, update_user_group, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
