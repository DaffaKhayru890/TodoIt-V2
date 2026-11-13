# Worker Deployment

## Deployment model

The API and worker use one codebase and one Docker image. They differ only in
the command they run:

| Process | Command |
|---|---|
| API | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Worker | `python -m app.services.notifications.worker` |

This keeps the modular monolith deployment unit while allowing the worker to
scale independently.

## Docker targets

`Dockerfile` defines three targets:

- `development` — editable install with dev dependencies, reload enabled.
- `test` — dev dependencies, default command `pytest`.
- `production` — runtime dependencies only, runs as non-root `appuser`.

The production image was verified to run the worker as UID 1000.

## Development compose

`compose.yaml` starts PostgreSQL, the API, and the worker:

```bash
docker compose up --build
```

Worker-specific settings:

```yaml
worker:
  build:
    context: .
    target: development
  command: python -m app.services.notifications.worker
  stop_grace_period: 20s
  restart: unless-stopped
```

The worker waits for PostgreSQL to become healthy and restarts if it exits
unexpectedly.

## Production compose

`compose.production.yaml` builds the `production` target for both services:

```bash
docker compose -f compose.production.yaml up -d --build
```

Required production variables include:

- `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY`
- `PAGINATION_CURSOR_SECRET`
- `REFRESH_COOKIE_SECURE=true`
- `CSRF_COOKIE_SECURE=true`

The worker uses `stop_grace_period: 30s`.

## Environment variables

| Variable | Default | Applies to | Notes |
|---|---|---|---|
| `AUTOMATIC_DUE_REMINDERS_ENABLED` | `true` | API | Creates automatic reminders on Todo changes |
| `DEFAULT_DUE_REMINDER_MINUTES` | `60` | API | Lead time before `due_at` |
| `NOTIFICATION_WORKER_ENABLED` | `true` | Worker | Set `false` to run the process as a no-op |
| `NOTIFICATION_POLL_INTERVAL_SECONDS` | `30` | Worker | 1–3600 |
| `NOTIFICATION_BATCH_SIZE` | `100` | Worker | 1–1000 |
| `NOTIFICATION_WORKER_SHUTDOWN_TIMEOUT_SECONDS` | `15` | Worker | Deployment grace-period budget; the worker exits after the current batch |

All four required Phase 5 variables are present in every `.env.*.example` file.

## Migrations

Run Alembic before starting either process:

```bash
alembic upgrade head
```

Phase 5 adds `20261116_reminder_notification_hardening`, which introduces:

- processed-at consistency check,
- automatic and manual pending partial unique indexes,
- notification read-state consistency check,
- notification keyset pagination index.

The migration is reversible:

```bash
alembic downgrade 20261115_add_reminders_and_notifications
```

`migrations/env.py` creates `alembic_version` as `VARCHAR(255)` because this
project uses descriptive revision identifiers longer than Alembic's default 32
characters. The version table is committed before migrations run.

## Scaling workers

Increase the worker replica count when notification latency grows:

```bash
docker compose -f compose.production.yaml up -d --scale worker=3
```

Safety properties:

- rows are claimed with `FOR UPDATE SKIP LOCKED`,
- one notification per reminder is enforced by a unique constraint,
- each batch is transactional,
- duplicate races are reconciled idempotently.

No Redis, Celery, Kafka, or leader election is required.

## Health and restart behavior

The API exposes `/health/live` and `/health/ready`. The worker has no HTTP port;
its health signal is process liveness and its log output. Compose uses
`restart: unless-stopped` so a crashed worker is restarted.

A transient database outage does not kill the worker at startup: it logs
`WORKER_DATABASE_UNAVAILABLE` and retries on the poll interval.

## Shutdown

Send `SIGTERM` to the worker container:

```bash
docker stop <worker-container>
```

Expected log sequence:

```text
notification worker received signal SIGTERM
notification worker stopped gracefully
notification worker database engine disposed
```

Exit code is 0. The current batch is allowed to finish before the process exits.

## Operational checks

```bash
# Is the worker process running?
docker compose ps worker

# Recent worker activity
docker compose logs --tail=100 worker

# Pending due backlog
psql "$DATABASE_URL" -c \
  "SELECT count(*) FROM reminders WHERE status='pending' AND remind_at <= now();"

# Notifications created in the last hour
psql "$DATABASE_URL" -c \
  "SELECT count(*) FROM notifications WHERE created_at > now() - interval '1 hour';"

# Duplicate guard
psql "$DATABASE_URL" -c \
  "SELECT reminder_id, count(*) FROM notifications
   GROUP BY reminder_id HAVING count(*) > 1;"
```

The duplicate query must always return zero rows.

## Rollback

1. Stop the worker.
2. Deploy the previous image or set `NOTIFICATION_WORKER_ENABLED=false`.
3. Downgrade the Phase 5 migration if the schema must be reverted.
4. Restart the API and worker.

Existing notification rows are retained unless the migration downgrade removes
Phase 5 indexes and constraints; it does not delete data.
