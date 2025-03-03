use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{mutate_state, read_state, run_regular_jobs, AddMemberArgs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use gated_groups::{check_if_passes_gate, CheckGateArgs, CheckIfPassesGateResult};
use group_canister::c2c_join_group::{Response::*, *};
use group_chat_core::AddResult;
use types::{AccessGate, MemberJoined, UsersUnblocked};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_group(args: Args) -> Response {
    run_regular_jobs();

    match read_state(|state| is_permitted_to_join(&args, state)) {
        Ok(Some(check_gate_args)) => match check_if_passes_gate(check_gate_args).await {
            CheckIfPassesGateResult::Success => {}
            CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
            CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
        },
        Ok(None) => {}
        Err(response) => return response,
    };

    mutate_state(|state| c2c_join_group_impl(args, state))
}

fn is_permitted_to_join(args: &Args, state: &RuntimeState) -> Result<Option<CheckGateArgs>, Response> {
    let caller = state.env.caller();

    // If the call is from the user index then we skip the checks
    if caller == state.data.user_index_canister_id {
        Ok(None)
    } else if state.data.is_frozen() {
        Err(ChatFrozen)
    } else if !state.data.is_accessible(args.principal, args.invite_code) {
        Err(NotInvited)
    } else if let Some(limit) = state.data.chat.members.user_limit_reached() {
        Err(ParticipantLimitReached(limit))
    } else if let Some(member) = state.data.chat.members.get(&args.user_id) {
        let summary = state.summary(member);
        Err(AlreadyInGroupV2(Box::new(summary)))
    } else {
        Ok(state.data.chat.gate.as_ref().map(|g| CheckGateArgs {
            gate: g.clone(),
            user_index_canister: state.data.user_index_canister_id,
            user_id: args.user_id,
            this_canister: state.env.canister_id(),
            now_nanos: state.env.now_nanos(),
        }))
    }
}

fn c2c_join_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let min_visible_event_index;
    let min_visible_message_index;

    if let Some(invitation) = state.data.get_invitation(args.principal) {
        min_visible_event_index = invitation.min_visible_event_index;
        min_visible_message_index = invitation.min_visible_message_index;
    } else if state.data.chat.history_visible_to_new_joiners {
        let (e, m) = state.data.chat.min_visible_indexes_for_new_members.unwrap_or_default();

        min_visible_event_index = e;
        min_visible_message_index = m;
    } else {
        let events_reader = state.data.chat.events.main_events_list();
        min_visible_event_index = events_reader.next_event_index();
        min_visible_message_index = events_reader.next_message_index();
    };

    // Unblock "platform moderator" if necessary
    let mut new_event = false;
    if args.is_platform_moderator && state.data.chat.members.is_blocked(&args.user_id) {
        state.data.chat.members.unblock(args.user_id, now);

        let event = UsersUnblocked {
            user_ids: vec![args.user_id],
            unblocked_by: args.user_id,
        };

        state
            .data
            .chat
            .events
            .push_main_event(ChatEventInternal::UsersUnblocked(Box::new(event)), args.correlation_id, now);

        new_event = true;
    }

    let response = match state.add_member(AddMemberArgs {
        user_id: args.user_id,
        principal: args.principal,
        now,
        min_visible_event_index,
        min_visible_message_index,
        mute_notifications: state.data.chat.is_public.value,
        is_bot: args.is_bot,
    }) {
        AddResult::Success(participant) => {
            let invitation = state.data.chat.invited_users.remove(&args.user_id, now);

            let event = MemberJoined {
                user_id: args.user_id,
                invited_by: invitation.map(|i| i.invited_by),
            };
            state.data.chat.events.push_main_event(
                ChatEventInternal::ParticipantJoined(Box::new(event)),
                args.correlation_id,
                now,
            );

            new_event = true;

            let summary = state.summary(&participant);

            // If there is a payment gate on this group then queue payments to owner(s) and treasury
            if let Some(AccessGate::Payment(gate)) = state.data.chat.gate.value.as_ref() {
                state.queue_access_gate_payments(gate.clone());
            }

            Success(Box::new(summary))
        }
        AddResult::AlreadyInGroup => {
            let member = state.data.chat.members.get(&args.user_id).unwrap();
            let summary = state.summary(member);
            AlreadyInGroupV2(Box::new(summary))
        }
        AddResult::Blocked => Blocked,
        AddResult::MemberLimitReached(limit) => ParticipantLimitReached(limit),
    };

    if new_event {
        handle_activity_notification(state);
    }

    response
}
