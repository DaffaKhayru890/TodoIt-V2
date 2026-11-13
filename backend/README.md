# TodoIt V2 Backend

This backend package contains the foundation for the TodoIt V2 modular monolith service.

## Stack
- Python 3.12+
- FastAPI
- SQLAlchemy 2.x (async)
- PostgreSQL
- Alembic
- Pydantic v2
- Docker / Compose

## Quick start

1. Copy one of the env templates to `.env` for the environment you want to run.
2. Install dependencies with `uv sync --group dev` (or `pip install -e .` plus the
   development tools listed in `pyproject.toml`).
3. Start the app with:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run the notification worker in a second process:

```bash
uv run python -m app.services.notifications.worker
```

Apply migrations before starting either process:

```bash
uv run alembic upgrade head
```

## Health endpoints
- `/health/live`
- `/health/ready`

## Phase 5 reminder and notification notes

Phase 5 adds personal reminders, automatic due-date reminders, and an in-app
notification inbox backed by PostgreSQL.

### Included features
- Manual reminder create, list, reschedule, and cancel
- Automatic reminder generation from Todo `due_at`
- Personal notification list, detail, mark-read, and mark-all-read
- Signed keyset cursor pagination for notifications
- Database-backed worker with `FOR UPDATE SKIP LOCKED`
- Idempotent delivery with one notification per reminder
- Graceful worker shutdown on `SIGINT` / `SIGTERM`
- Docker Compose worker services for development and production

### API summary

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/todos/{todo_id}/reminders` | Create a manual reminder |
| `GET` | `/api/v1/todos/{todo_id}/reminders` | List the current user's reminders |
| `PATCH` | `/api/v1/reminders/{reminder_id}` | Reschedule a pending manual reminder |
| `DELETE` | `/api/v1/reminders/{reminder_id}` | Cancel a reminder |
| `GET` | `/api/v1/notifications` | List the current user's notifications |
| `GET` | `/api/v1/notifications/{notification_id}` | Get a notification |
| `POST` | `/api/v1/notifications/{notification_id}/read` | Mark one notification read |
| `POST` | `/api/v1/notifications/read-all` | Mark all notifications read |

Reminders and notifications are always personal. The recipient comes from the
access token and cannot be supplied by the client.

### Phase 5 environment variables

| Variable | Default | Purpose |
|---|---|---|
| `AUTOMATIC_DUE_REMINDERS_ENABLED` | `true` | Enable automatic due-date reminders |
| `DEFAULT_DUE_REMINDER_MINUTES` | `60` | Lead time before `due_at` |
| `NOTIFICATION_WORKER_ENABLED` | `true` | Enable worker polling |
| `NOTIFICATION_POLL_INTERVAL_SECONDS` | `30` | Delay between worker batches |
| `NOTIFICATION_BATCH_SIZE` | `100` | Maximum reminders per batch |

### Docker

```bash
# Development API + worker + PostgreSQL
docker compose up --build

# Production API + worker + PostgreSQL
docker compose -f compose.production.yaml up -d --build
```

### Tests

```bash
uv run pytest
uv run coverage run -m pytest
uv run coverage report
uv run ruff check .
uv run ruff format --check .
```

The Phase 5 domain modules are covered at 96% (whole-application coverage is
lower because the legacy Phase 0–4 suite is intentionally small).

### Documentation
- `docs/phase-4-implementation-report.md`
- `docs/phase-5-implementation-report.md`
- `docs/reminder-system.md`
- `docs/reminder-lifecycle.md`
- `docs/automatic-due-reminder.md`
- `docs/notification-system.md`
- `docs/notification-api.md`
- `docs/notification-worker.md`
- `docs/worker-deployment.md`
