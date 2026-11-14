# Phase 5 Implementation Report

## 1. Summary

Phase 5 adds a complete reminder and in-app notification system to the TodoIt V2
modular monolith:

- personal manual reminder CRUD,
- automatic due-date reminders derived from Todo `due_at`,
- persistent notification inbox with read state,
- signed cursor pagination,
- a PostgreSQL-backed notification worker with `FOR UPDATE SKIP LOCKED`,
- Docker Compose worker services for development and production,
- Phase 5 database constraints, indexes, tests, and documentation.

No Phase 6 work was started.

## 2. Architecture

The implementation preserves the modular monolith:

```text
app/
├── common/
│   └── cursor.py                 # shared signed cursor encode/decode
├── core/
│   ├── clock.py                  # injectable UTC clock
│   ├── config.py                 # Phase 5 settings
│   ├── exceptions.py             # stable API error codes
│   └── database.py               # async engine/session factory
├── services/
│   ├── reminders/
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   ├── controllers/
│   │   └── routes/
│   ├── notifications/
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   ├── worker.py
│   │   ├── controllers/
│   │   └── routes/
│   └── todos/service.py          # automatic reminder synchronization
├── migrations/
│   └── versions/20261116_reminder_notification_hardening.py
└── tests/
```

The API and worker share the same image and domain code. The worker is started
with `python -m app.services.notifications.worker`.

## 3. Data model

### Reminders

- status: `pending`, `processed`, `cancelled`
- source: `manual`, `automatic`
- `processed_at` consistency enforced by a check constraint
- partial unique index for one pending automatic reminder per Todo/recipient
- partial unique index for duplicate manual reminders at the same instant

### Notifications

- personal `user_id` recipient
- snapshot `title` and `message`
- type: `todo_reminder` or `due_date_reminder`
- unique `reminder_id`
- read-state consistency check
- indexes for user inbox, unread filter, and keyset pagination
- `todo_id` and `reminder_id` use `ON DELETE SET NULL` to preserve history

### Migration

`20261116_reminder_notification_hardening` adds the Phase 5 constraints and
indexes. `migrations/env.py` now:

- creates `alembic_version` as `VARCHAR(255)` for descriptive revision IDs,
- commits the version table before running migrations,
- escapes `%` in the database URL.

## 4. API

### Reminders

| Method | Path |
|---|---|
| `POST` | `/api/v1/todos/{todo_id}/reminders` |
| `GET` | `/api/v1/todos/{todo_id}/reminders` |
| `PATCH` | `/api/v1/reminders/{reminder_id}` |
| `DELETE` | `/api/v1/reminders/{reminder_id}` |

- Recipient is always the authenticated user.
- `user_id`, `source`, and `status` are rejected in request bodies.
- Manual reminders must be future, timezone-aware instants.
- Automatic reminders cannot be edited or cancelled directly.
- Cancellation is idempotent and soft.

### Notifications

| Method | Path |
|---|---|
| `GET` | `/api/v1/notifications` |
| `GET` | `/api/v1/notifications/{notification_id}` |
| `POST` | `/api/v1/notifications/{notification_id}/read` |
| `POST` | `/api/v1/notifications/read-all` |

- All operations are scoped to the authenticated user.
- List uses signed keyset pagination, `created_at DESC, id DESC`.
- Cursors are bound to the user and `is_read` filter.
- Read and read-all are idempotent.

All Phase 5 errors use the shared envelope with stable codes such as
`REMINDER_DUPLICATE`, `REMINDER_INVALID_TIME`, and
`NOTIFICATION_CURSOR_SIGNATURE_INVALID`.

## 5. Automatic due-date reminders

When a Todo is created or updated:

- a future `due_at` creates or moves one automatic reminder for the creator,
- `trigger_at = due_at - DEFAULT_DUE_REMINDER_MINUTES`,
- a trigger in the past is clamped to now,
- clearing the due date cancels only automatic reminders,
- completing the Todo cancels all pending reminders,
- reopening schedules a new automatic reminder when possible,
- reminder synchronization participates in the Todo transaction and rolls back
  with it.

Configuration:

- `AUTOMATIC_DUE_REMINDERS_ENABLED` (default `true`)
- `DEFAULT_DUE_REMINDER_MINUTES` (default `60`)

## 6. Worker

`process_due_reminders`:

- selects due pending reminders with `FOR UPDATE SKIP LOCKED`,
- processes one batch per transaction,
- uses a savepoint per reminder,
- creates the notification and marks the reminder processed atomically,
- reconciles duplicate races using the existing notification,
- leaves failed reminders pending for a later poll.

`run_worker`:

- polls on `NOTIFICATION_POLL_INTERVAL_SECONDS`,
- survives transient iteration failures,
- stops on `SIGINT`/`SIGTERM`,
- disposes the engine on exit.

Configuration:

- `NOTIFICATION_WORKER_ENABLED` (default `true`)
- `NOTIFICATION_POLL_INTERVAL_SECONDS` (default `30`)
- `NOTIFICATION_BATCH_SIZE` (default `100`)

## 7. Docker and deployment

- `compose.yaml` adds a development worker service.
- `compose.production.yaml` adds a production worker service.
- Worker containers use `stop_grace_period` and `restart: unless-stopped`.
- The production image runs as non-root `appuser`.
- The Dockerfile now installs the `dev` dependency group for development and
  test targets.
- The worker package `__init__` files no longer import models eagerly, fixing a
  circular import when running the worker as a module.

Verified runtime behavior:

- production worker starts as UID 1000,
- worker exits 0 when disabled,
- worker handles `SIGTERM` gracefully and logs engine disposal.

## 8. Verification results

All commands were run in `backend/` with the PostgreSQL test database.

### Tests

```text
186 passed in 45.04s
```

Test files: 25. Phase 5 coverage includes:

- reminder validation and time calculation,
- automatic reminder synchronization,
- Todo completion/reopen/delete integration,
- reminder API create/list/update/delete,
- notification service and cursor handling,
- notification API list/detail/read/read-all,
- worker selection, runtime, idempotency, and failure isolation,
- concurrent workers with separate engines and `SKIP LOCKED`,
- batch draining without lost reminders.

Additional regression tests were added to raise whole-application coverage
without weakening the Phase 5 assertions:

- `tests/api/test_auth_api.py` — register, login, refresh rotation, replay
  detection, logout/logout-all, token authentication, revoked sessions,
  `/auth/me`, `/users/me`.
- `tests/api/test_workspaces_api.py` — workspace CRUD, archive, member roles,
  invitations, accept/revoke, legacy route aliases, permission boundaries.
- `tests/api/test_todos_api.py` — Todo CRUD, all views, combined filters,
  search, tag/label assignment, cursor pagination, cursor tampering, and
  cross-workspace isolation.
- `tests/api/test_tags_labels_api.py` — tag/label CRUD, validation, duplicate
  names, and role-based permissions.
- `tests/unit/test_common_utils.py` — response helpers, environment enum,
  clock utility, DB dependency, and `TodoRepository`.

### Phase 4 bugs found and fixed during regression testing

1. Todo tag/label assignment performed an async lazy load
   (`todo.tags = []` after `flush()`), which raised `MissingGreenlet`. The
   relationship assignment now happens while the Todo is still transient, and
   `TodoService.get_by_id` / `list_todos` eager-load tags and labels with
   `selectinload`.
2. `TodoService.create_todo`, `list_todos`, and `update_todo` used a `status`
   parameter that shadowed the imported FastAPI `status` module, so validation
   error branches raised `AttributeError`. The module is now imported as
   `http_status`.

### Coverage

Coverage is configured with `concurrency = ["greenlet"]` because SQLAlchemy's
async bridge switches greenlets. Without this, coverage can lose trace data and
can fail inside SQLAlchemy's Cython cache-key helper.

| Scope | Coverage |
|---|---|
| Phase 5 domain modules (`reminders`, `notifications`, cursor, clock) | **96%** |
| Whole application | **90%** |

Both figures exceed the 85% target. The whole-application figure was raised by
adding substantive regression tests for the existing authentication, workspace,
Todo, tag, and label modules rather than empty tests.

Key Phase 5 file coverage:

| File | Coverage |
|---|---|
| `notifications/service.py` | 98% |
| `notifications/repository.py` | 100% |
| `notifications/worker.py` | 94% |
| `reminders/service.py` | 93% |
| `reminders/repository.py` | 100% |
| `common/cursor.py` | 88% |
| `core/clock.py` | 100% |

### Ruff

```text
ruff check .        -> All checks passed
ruff format --check -> 144 files already formatted
```

### Alembic

Verified on a fresh database:

```text
alembic heads   -> 20261116_reminder_notification_hardening (head)
alembic upgrade head
alembic current -> 20261116_reminder_notification_hardening (head)
alembic downgrade 20261115_add_reminders_and_notifications
alembic current -> 20261115_add_reminders_and_notifications
alembic upgrade head
alembic current -> 20261116_reminder_notification_hardening (head)
```

The upgrade created all 13 tables, including `reminders` and `notifications`.
The downgrade removed the Phase 5 partial indexes, and the re-upgrade restored
them.

### Docker

Built successfully:

- `todo-backend:development` (`--target development`)
- `todo-backend:test` (`--target test`)
- `todo-backend:production` (`--target production`)

The test image reports `pytest 8.4.2` and `ruff 0.17.5`. The production image
runs as `uid=1000(appuser)`.

Runtime verification was performed with the production image against a dedicated
PostgreSQL database (`todoit_phase5_runtime`), using the real Alembic migration
and two concurrent worker containers:

```text
API /health/live   -> 200 {"status":"alive"}
API /health/ready  -> 200 {"status":"ready"}
worker-1           -> selected=1 processed=1 duplicates=0 cancelled=0 failed=0
GET notifications  -> 1 due_date_reminder for the Todo creator
mark as read       -> is_read=true, read_at set
list unread        -> empty
read-all           -> updated_count=0 (idempotent)
```

Two workers were running during the batch; only one processed the reminder and
exactly one notification was created, confirming `SKIP LOCKED` behavior at the
container level. Graceful shutdown was verified:

```text
notification worker received signal SIGTERM
notification worker stopped gracefully
notification worker database engine disposed
```

The containers and temporary databases were removed after verification.

## 9. Documentation

Added:

- `docs/reminder-system.md`
- `docs/reminder-lifecycle.md`
- `docs/automatic-due-reminder.md`
- `docs/notification-system.md`
- `docs/notification-api.md`
- `docs/notification-worker.md`
- `docs/worker-deployment.md`
- `docs/phase-5-implementation-report.md` (this file)

Updated:

- `README.md`
- `docs/technical-decisions.md`

## 10. Known limitations

- No email, SMS, or push delivery; notifications are in-app only.
- No retention purge for old notifications.
- No dead-letter queue; failed reminders remain pending and retry on later polls.
- No user-configurable lead time per Todo; the lead time is global.
- Manual reminders are not automatically recreated when a Todo is reopened.
- The worker is at-least-once at the process level; database uniqueness provides
  exactly-once notification creation.

## 11. Definition of Done

- [x] Reminder model and lifecycle implemented
- [x] Manual reminder CRUD implemented
- [x] Automatic due-date reminders implemented
- [x] Personal notification persistence implemented
- [x] Notification read and read-all implemented
- [x] Signed cursor pagination implemented
- [x] Database-backed worker implemented
- [x] `FOR UPDATE SKIP LOCKED` concurrency safety implemented
- [x] Idempotency and duplicate reconciliation implemented
- [x] Graceful shutdown implemented
- [x] Docker development and production worker services added
- [x] Phase 5 migration added and verified
- [x] Required environment variables added to all templates
- [x] Ruff checks pass
- [x] Full test suite passes
- [x] Whole-application coverage exceeds 85% (measured 90%; Phase 5 modules 96%)
- [x] Documentation completed
- [x] No Phase 6 work started
