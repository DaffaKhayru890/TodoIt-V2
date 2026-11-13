# Automatic Due-Date Reminders

## Goal

Every Todo with a future due date automatically receives one pending reminder
for its creator. The reminder is delivered `DEFAULT_DUE_REMINDER_MINUTES` before
`due_at` (60 minutes by default).

Automatic reminders require no client action and are fully derived from the Todo
state.

## Configuration

| Variable | Default | Validation |
|---|---|---|
| `AUTOMATIC_DUE_REMINDERS_ENABLED` | `true` | Boolean |
| `DEFAULT_DUE_REMINDER_MINUTES` | `60` | 1–10080 minutes |

When `AUTOMATIC_DUE_REMINDERS_ENABLED=false`, Todo create/update operations do
not create or move automatic reminders. Existing pending automatic reminders
are not retroactively deleted.

## Recipient

The recipient is always the Todo creator (`todos.created_by`). Workspace members
do not receive automatic reminders for Todos they did not create. A user can
still create personal manual reminders for any Todo they can access.

## Synchronization algorithm

`ReminderService.sync_automatic_reminder_for_todo` runs inside the Todo
service's transaction:

1. If automatic reminders are disabled, return without changes.
2. If the Todo is `completed`, cancel every pending reminder for the Todo.
3. If `due_at` is `NULL`, cancel the creator's pending automatic reminder.
4. If `due_at <= now`, cancel the creator's pending automatic reminder.
5. Compute `trigger_at = due_at - lead_time`.
6. If `trigger_at <= now`, clamp it to `now` so the worker delivers it on the
   next poll instead of scheduling a past trigger.
7. Lock and update an existing pending automatic reminder, or insert a new one.

The method only flushes. `TodoService` commits the Todo change and the reminder
change atomically. If reminder synchronization raises, the Todo change is rolled
back.

## Trigger examples

Assume `DEFAULT_DUE_REMINDER_MINUTES=60` and `now = 2026-11-13T10:00:00Z`.

| Todo `due_at` | Result |
|---|---|
| `2026-11-13T12:00:00Z` | Reminder at `11:00:00Z` |
| `2026-11-13T10:30:00Z` | Reminder at `10:00:00Z` (clamped to now) |
| `2026-11-13T09:00:00Z` | No reminder; pending automatic cancelled |
| `NULL` | No reminder; pending automatic cancelled |
| Todo completed | All pending reminders cancelled |

## Todo update behavior

The Todo update service distinguishes “due date omitted” from “due date set to
null” with `due_at_provided`.

- Omitted: the due date is unchanged; synchronization still reconciles the
  automatic reminder to the existing due date.
- Provided with a new future value: the existing pending automatic reminder is
  moved.
- Provided as `null`: only automatic reminders are cancelled; manual reminders
  remain pending.
- Status changed to `completed`: all pending reminders are cancelled.
- Status changed from `completed` to an active status: an automatic reminder is
  scheduled again if a future due date exists.

## Why automatic reminders are not editable

Automatic reminders represent the Todo due date. Allowing direct edits would
make the reminder diverge from the source of truth. The API therefore rejects
`PATCH` on `source = automatic` with `REMINDER_INVALID_STATE`.

To change an automatic reminder, change the Todo `due_at`. To add an extra
alert, create a manual reminder.

## Interaction with manual reminders

- Automatic and manual reminders can coexist for the same Todo and user.
- Clearing the due date cancels only automatic reminders.
- Completing the Todo cancels both kinds.
- Deleting the Todo deletes both kinds and preserves notification history.

## Concurrency

The partial unique index `uq_reminders_automatic_pending` allows at most one
pending automatic reminder per `(todo_id, user_id)`. Synchronization locks the
existing row with `FOR UPDATE`, so concurrent Todo updates cannot create two
pending automatic reminders.

## Testing

Covered scenarios include:

- creation with and without a due date,
- rescheduling when the due date moves,
- clamping a near due date to the current time,
- clearing the due date while preserving manual reminders,
- completion cancelling every pending reminder,
- reopening scheduling a new automatic reminder,
- rollback of the Todo change when reminder synchronization fails.
