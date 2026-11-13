# Notification Worker

## Overview

The notification worker is a database-backed polling process that runs in the
same codebase and container image as the API. It converts due reminders into
notifications. It does not use Redis, Celery, Kafka, or an external scheduler.

Entry point:

```bash
python -m app.services.notifications.worker
```

Implementation: `app/services/notifications/worker.py`.

## Processing loop

`run_worker` repeats until a shutdown event is set:

1. Call `process_due_reminders` for one batch.
2. Log failures without terminating the loop.
3. Wait for `NOTIFICATION_POLL_INTERVAL_SECONDS` or until shutdown is requested.

`max_iterations` is available for smoke tests; production leaves it unset.

## Batch selection

Each batch runs in its own short-lived session and transaction:

```sql
SELECT *
FROM reminders
WHERE status = 'pending'
  AND remind_at <= :now
ORDER BY remind_at ASC, id ASC
LIMIT :batch_size
FOR UPDATE SKIP LOCKED;
```

`FOR UPDATE SKIP LOCKED` lets multiple worker processes run concurrently without
claiming the same reminder. Each worker locks only the rows it selected.

## Per-reminder processing

For every selected reminder, the worker opens a savepoint and:

1. Re-checks `status = 'pending'`.
2. Re-checks `remind_at <= now`.
3. Calls `NotificationService.create_notification_for_reminder`.
4. Counts the result as `processed`, `duplicates`, `cancelled`, or `failed`.

The service cancels the reminder instead of creating a notification when:

- the Todo no longer exists,
- the Todo is completed,
- the recipient is missing or inactive,
- the workspace is missing or archived,
- the recipient is no longer a workspace member.

## Batch result

```python
WorkerIterationResult(
    selected=0,
    processed=0,
    duplicates=0,
    cancelled=0,
    failed=0,
)
```

The result is logged when any counter is non-zero:

```text
notification worker batch completed selected=10 processed=9 duplicates=1 cancelled=0 failed=0
```

## Idempotency and races

The unique constraint on `notifications.reminder_id` is the final guard.

- If a reminder already has a notification, the service returns it and marks the
  reminder processed.
- If another worker commits the same reminder between selection and insert, the
  insert raises an integrity error.
- The worker rolls back the savepoint, looks up the existing notification, marks
  the reminder processed, and counts a duplicate.
- If no notification exists, the reminder stays pending and is counted as
  failed.

A malformed record or unexpected exception is isolated to its savepoint. Other
reminders in the batch still complete.

## Why one transaction per batch

- Lock duration stays short.
- A batch failure does not leave partially claimed reminders.
- Retrying after a crash simply selects pending rows again.
- Per-reminder savepoints prevent one bad row from aborting the batch.

## Graceful shutdown

`main` installs handlers for `SIGINT` and `SIGTERM`. On a signal:

1. The stop event is set.
2. The current batch finishes.
3. The loop exits.
4. The database engine is disposed.
5. The process exits with code 0.

Compose sets `stop_grace_period` to 20–30 seconds so the container runtime waits
for the current transaction.

## Startup validation

`main` validates configuration before polling. Invalid configuration exits with
code 2. A failed initial database check is logged but does not terminate the
process; the loop retries on the next poll interval.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NOTIFICATION_WORKER_ENABLED` | `true` | Disable polling without changing the API |
| `NOTIFICATION_POLL_INTERVAL_SECONDS` | `30` | Delay between batches |
| `NOTIFICATION_BATCH_SIZE` | `100` | Maximum reminders per batch |
| `NOTIFICATION_WORKER_SHUTDOWN_TIMEOUT_SECONDS` | `15` | Deployment grace-period budget; the worker exits after the current batch |

## Scaling

Run multiple worker replicas for throughput. Safety comes from:

- `FOR UPDATE SKIP LOCKED` for row claiming,
- a unique notification per reminder,
- transactional state changes,
- idempotent reconciliation.

No leader election or distributed lock is required.

## Observability

The worker logs:

- configuration-disabled startup,
- database-unavailable startup warning,
- batch counters,
- per-reminder failures with stack traces,
- received shutdown signal,
- graceful stop and engine disposal.

## Tests

The test suite covers:

- empty batches,
- single and multiple due reminders,
- future, cancelled, and processed reminders,
- completed Todos, archived workspaces, inactive users, and removed members,
- idempotency across iterations,
- duplicate reconciliation,
- savepoint isolation,
- batch-size draining,
- concurrent workers with separate engines,
- `SKIP LOCKED` behavior,
- signal handling and graceful shutdown,
- startup validation and engine disposal.
