# Reminder System

## Purpose

Reminders are personal, persistent triggers attached to a Todo. Phase 5 supports
two kinds of reminder:

- **Manual reminders** are created by a user through the API for themselves.
- **Automatic due-date reminders** are derived from a Todo's `due_at` value and
  are owned by the Todo creator.

Reminders never send email or push messages. When a reminder becomes due, the
notification worker converts it into an in-app notification owned by the
reminder recipient.

## Data model

`reminders` stores one row per scheduled trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `todo_id` | UUID | Required, `ON DELETE CASCADE` |
| `user_id` | UUID | Required recipient, `ON DELETE CASCADE` |
| `source` | string | `manual` or `automatic` |
| `remind_at` | timestamptz | UTC instant when the reminder becomes due |
| `status` | string | `pending`, `processed`, or `cancelled` |
| `processed_at` | timestamptz | Set only when `status = 'processed'` |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last state change timestamp |

### Status semantics

- `pending` — eligible for worker delivery once `remind_at <= now()`.
- `processed` — a notification has been created and linked to this reminder.
- `cancelled` — the reminder will never be delivered. Notification history is
  not deleted.

The database enforces that `processed_at` is present exactly when the status is
`processed`.

### Source semantics

- `manual` — created, rescheduled, and cancelled by the owner through the API.
- `automatic` — synchronized from the Todo due date. It cannot be edited or
  cancelled directly through the reminder API.

## Ownership and authorization

Reminders are personal even when the Todo is shared.

- The recipient is always `user_id` from the authenticated request, never a
  client-supplied value.
- Listing reminders for a Todo returns only the current user's reminders.
- Updating or cancelling a reminder is allowed only for its owner.
- Creating or listing reminders requires access to the Todo's workspace.
- `source` and `status` cannot be supplied by API clients.

## Database integrity

Phase 5 adds these constraints and partial unique indexes:

- `ck_reminders_status` — status must be `pending`, `processed`, or `cancelled`.
- `ck_reminders_source` — source must be `manual` or `automatic`.
- `ck_reminders_processed_at_consistency` — `processed_at` matches status.
- `uq_reminders_automatic_pending` — at most one pending automatic reminder per
  `(todo_id, user_id)`.
- `uq_reminders_manual_pending_time` — at most one pending manual reminder per
  `(todo_id, user_id, remind_at)`.

Processed and cancelled rows are excluded from the partial indexes so a new
reminder can be scheduled after a previous one has been delivered.

## API summary

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/todos/{todo_id}/reminders` | Create a manual reminder |
| `GET` | `/api/v1/todos/{todo_id}/reminders` | List the current user's reminders |
| `PATCH` | `/api/v1/reminders/{reminder_id}` | Reschedule a pending manual reminder |
| `DELETE` | `/api/v1/reminders/{reminder_id}` | Cancel a reminder |

### Create example

```http
POST /api/v1/todos/6a8f5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10/reminders
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "remind_at": "2026-11-15T10:00:00Z"
}
```

```json
{
  "id": "0f8b5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
  "todo_id": "6a8f5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
  "user_id": "b1f8b5f0-4d0b-4f2f-9f8b-2f6b8a6f6f10",
  "source": "manual",
  "remind_at": "2026-11-15T10:00:00Z",
  "status": "pending",
  "processed_at": null,
  "created_at": "2026-11-13T10:00:00Z",
  "updated_at": "2026-11-13T10:00:00Z"
}
```

## Time rules

- `remind_at` must include timezone information.
- It is normalized to UTC for storage.
- It must be strictly in the future at creation or rescheduling time.
- A naive datetime or a past instant returns `REMINDER_INVALID_TIME` (422).

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `AUTOMATIC_DUE_REMINDERS_ENABLED` | `true` | Enables automatic reminder synchronization |
| `DEFAULT_DUE_REMINDER_MINUTES` | `60` | Lead time before `due_at` |

## Error codes

All Phase 5 errors use the centralized error envelope:

```json
{
  "success": false,
  "error": {
    "code": "REMINDER_DUPLICATE",
    "message": "A pending reminder already exists for this time",
    "request_id": "..."
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `REMINDER_NOT_FOUND` | 404 | Reminder does not exist |
| `REMINDER_TODO_NOT_FOUND` | 404 | Todo does not exist or is inaccessible |
| `REMINDER_INVALID_TIME` | 422 | Time is naive, invalid, or not in the future |
| `REMINDER_ALREADY_PROCESSED` | 409 | Processed reminders are immutable |
| `REMINDER_ALREADY_CANCELLED` | 409 | Cancelled reminders cannot be rescheduled |
| `REMINDER_PERMISSION_DENIED` | 403 | Reminder belongs to another user |
| `REMINDER_USER_NOT_MEMBER` | 403 | Caller cannot access the Todo workspace |
| `REMINDER_INVALID_STATE` | 409 | Operation is not valid for the reminder source/state |
| `REMINDER_DUPLICATE` | 409 | Duplicate pending manual reminder |

## Related documents

- [`reminder-lifecycle.md`](reminder-lifecycle.md)
- [`automatic-due-reminder.md`](automatic-due-reminder.md)
- [`notification-system.md`](notification-system.md)
