use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use group_canister::events_window::{Response::*, *};
use group_chat_core::EventsResult;
use ic_cdk_macros::query;

#[query]
fn events_window(args: Args) -> Response {
    read_state(|state| events_window_impl(args, state))
}

fn events_window_impl(args: Args, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    let caller = state.env.caller();
    let user_id = state.data.lookup_user_id(caller);

    match state.data.chat.events_window(
        user_id,
        args.thread_root_message_index,
        args.mid_point,
        args.max_messages,
        args.max_events,
    ) {
        EventsResult::Success(response) => Success(response),
        EventsResult::UserNotInGroup => CallerNotInGroup,
        EventsResult::ThreadNotFound => ThreadMessageNotFound,
    }
}
