use crate::{generate_query_call, generate_update_call};
use user_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(initial_state);
generate_query_call!(saved_crypto_accounts);
generate_query_call!(updates);

// Updates
generate_update_call!(add_reaction);
generate_update_call!(block_user);
generate_update_call!(cancel_message_reminder);
generate_update_call!(create_community);
generate_update_call!(create_group);
generate_update_call!(delete_community);
generate_update_call!(delete_direct_chat);
generate_update_call!(delete_group);
generate_update_call!(delete_messages);
generate_update_call!(edit_message_v2);
generate_update_call!(leave_community);
generate_update_call!(leave_group);
generate_update_call!(mark_read);
generate_update_call!(mute_notifications);
generate_update_call!(remove_reaction);
generate_update_call!(save_crypto_account);
generate_update_call!(send_message_v2);
generate_update_call!(send_message_with_transfer_to_channel);
generate_update_call!(send_message_with_transfer_to_group);
generate_update_call!(set_message_reminder_v2);
generate_update_call!(tip_message);
generate_update_call!(unblock_user);
generate_update_call!(undelete_messages);

pub mod happy_path {
    use crate::rng::random_message_id;
    use crate::User;
    use pocket_ic::PocketIc;
    use types::{
        CanisterId, Chat, ChatId, CommunityId, Cryptocurrency, EventIndex, EventsResponse, MessageContentInitial, MessageId,
        Reaction, Rules, TextContent, TimestampMillis, UserId,
    };

    pub fn send_text_message(
        env: &mut PocketIc,
        sender: &User,
        recipient: UserId,
        text: impl ToString,
        message_id: Option<MessageId>,
    ) -> user_canister::send_message_v2::SuccessResult {
        let response = super::send_message_v2(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::send_message_v2::Args {
                recipient,
                thread_root_message_index: None,
                message_id: message_id.unwrap_or_else(random_message_id),
                content: MessageContentInitial::Text(TextContent { text: text.to_string() }),
                replies_to: None,
                forwarding: false,
                correlation_id: 0,
            },
        );

        match response {
            user_canister::send_message_v2::Response::Success(result) => result,
            response => panic!("'send_message' error: {response:?}"),
        }
    }

    pub fn create_group(
        env: &mut PocketIc,
        sender: &User,
        name: &str,
        is_public: bool,
        history_visible_to_new_joiners: bool,
    ) -> ChatId {
        let response = super::create_group(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::create_group::Args {
                is_public,
                name: name.to_string(),
                description: format!("{name}_description"),
                avatar: None,
                history_visible_to_new_joiners,
                permissions_v2: None,
                rules: Rules::default(),
                events_ttl: None,
                gate: None,
            },
        );

        match response {
            user_canister::create_group::Response::Success(result) => result.chat_id,
            response => panic!("'create_group' error: {response:?}"),
        }
    }

    pub fn create_community(
        env: &mut PocketIc,
        sender: &User,
        name: &str,
        is_public: bool,
        default_channels: Vec<String>,
    ) -> CommunityId {
        let response = super::create_community(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::create_community::Args {
                is_public,
                name: name.to_string(),
                description: format!("{name}_description"),
                avatar: None,
                banner: None,
                history_visible_to_new_joiners: is_public,
                permissions: None,
                rules: Rules::default(),
                gate: None,
                default_channels,
                default_channel_rules: None,
                primary_language: "en".to_string(),
            },
        );

        match response {
            user_canister::create_community::Response::Success(result) => result.community_id,
            response => panic!("'create_community' error: {response:?}"),
        }
    }

    pub fn add_reaction(env: &mut PocketIc, sender: &User, user_id: UserId, reaction: impl ToString, message_id: MessageId) {
        let response = super::add_reaction(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::add_reaction::Args {
                user_id,
                thread_root_message_index: None,
                message_id,
                reaction: Reaction::new(reaction.to_string()),
                correlation_id: 0,
            },
        );
        assert!(matches!(response, user_canister::add_reaction::Response::Success));
    }

    pub fn initial_state(env: &PocketIc, sender: &User) -> user_canister::initial_state::SuccessResult {
        let response = super::initial_state(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::initial_state::Args { disable_cache: None },
        );

        let user_canister::initial_state::Response::Success(result) = response;
        result
    }

    pub fn events(
        env: &PocketIc,
        sender: &User,
        user_id: UserId,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResponse {
        let response = super::events(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::events::Args {
                user_id,
                thread_root_message_index: None,
                start_index,
                ascending,
                max_messages,
                max_events,
                latest_known_update: None,
            },
        );

        match response {
            user_canister::events::Response::Success(result) => result,
            response => panic!("'events' error: {response:?}"),
        }
    }

    pub fn events_by_index(env: &PocketIc, sender: &User, user_id: UserId, events: Vec<EventIndex>) -> EventsResponse {
        let response = super::events_by_index(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::events_by_index::Args {
                user_id,
                thread_root_message_index: None,
                events,
                latest_known_update: None,
            },
        );

        match response {
            user_canister::events_by_index::Response::Success(result) => result,
            response => panic!("'events_by_index' error: {response:?}"),
        }
    }

    pub fn leave_group(env: &mut PocketIc, user: &User, group_id: ChatId) {
        let response = super::leave_group(
            env,
            user.principal,
            user.canister(),
            &user_canister::leave_group::Args {
                chat_id: group_id,
                correlation_id: 0,
            },
        );

        assert!(matches!(response, user_canister::leave_group::Response::Success));
    }

    pub fn leave_community(env: &mut PocketIc, user: &User, community_id: CommunityId) {
        let response = super::leave_community(
            env,
            user.principal,
            user.canister(),
            &user_canister::leave_community::Args { community_id },
        );

        assert!(matches!(response, user_canister::leave_community::Response::Success));
    }

    pub fn updates(
        env: &PocketIc,
        user: &User,
        updates_since: TimestampMillis,
    ) -> Option<user_canister::updates::SuccessResult> {
        let response = super::updates(
            env,
            user.principal,
            user.canister(),
            &user_canister::updates::Args { updates_since },
        );

        match response {
            user_canister::updates::Response::Success(result) => Some(result),
            user_canister::updates::Response::SuccessNoUpdates => None,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn tip_message(
        env: &mut PocketIc,
        sender: &User,
        recipient: UserId,
        chat: Chat,
        message_id: MessageId,
        ledger: CanisterId,
        token: Cryptocurrency,
        amount: u128,
    ) {
        let response = super::tip_message(
            env,
            sender.principal,
            sender.canister(),
            &user_canister::tip_message::Args {
                chat,
                recipient,
                thread_root_message_index: None,
                message_id,
                ledger,
                amount,
                fee: token.fee().unwrap(),
                decimals: token.decimals().unwrap(),
                token,
            },
        );

        assert!(matches!(response, user_canister::tip_message::Response::Success))
    }
}
