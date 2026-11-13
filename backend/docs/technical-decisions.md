# Technical Decisions

## Decision table

| Decision | Chosen Approach | Reason |
|---|---|---|
| Architecture | Modular Monolith | Best balance between maintainability and implementation simplicity |
| ORM | SQLAlchemy 2.x | Modern async ORM with strong PostgreSQL integration |
| Database | PostgreSQL | Relational consistency and mature concurrent features |
| DB Access | AsyncSession | Matches async FastAPI request flow and modern SQLAlchemy |
| Migration | Alembic | Managed schema evolution and repeatability |
| Authentication | JWT | Stateless access control suitable for modern API clients |
| Refresh management | Rotation and revocation | Stronger security than static refresh tokens |
| Password hashing | Argon2 | Best-practice password hashing with strong resistance to brute-force |
| Pagination | Cursor-based keyset | Stable infinite-scroll behavior and better large dataset support |
| Notification processing | Database-backed worker | Persistent, recoverable, and simple within the monolith |
| Notification pagination | Signed keyset cursor | User- and filter-bound cursors without OFFSET drift |
| Reminder concurrency | `FOR UPDATE SKIP LOCKED` | Multiple workers can claim disjoint batches safely |
| Reminder idempotency | Unique notification per reminder | Prevents duplicate delivery across races and restarts |
| Containerization | Docker multi-stage | Separation of build, test, and production runtime environments |
| Time handling | UTC primary storage | Reduces ambiguity and makes timezone conversion consistent |
| Workspace access model | Role-based memberships | Clear authorization boundaries and easier permission enforcement |

## Additional technical decisions

### Soft delete vs hard delete

The design uses archive/soft-delete semantics for workspaces and leaves item-level delete behavior to the domain service rules. This retains historical integrity and avoids accidental irreversible data loss for collaborative resources.

### Service boundaries

Each domain module owns its own models, repository, and schemas to reduce cross-service coupling. This is simpler than a layered enterprise framework while still being maintainable.

### No generic base repository

A generic repository pattern is intentionally avoided to keep the code explicit and avoid unnecessary abstraction. The system can still benefit from a consistent repository style without forcing a heavy abstraction layer that adds complexity.

### No over-engineering for background processing

The reminder worker is kept small and database-driven. It does not require Redis, Celery, or Kafka for initial implementation because the project requirement is a single-monolith application with persistent PostgreSQL processing.

### Phase 5 reminder ownership and state

Reminders are personal resources. The recipient is always the authenticated
user for manual reminders and the Todo creator for automatic reminders.
`source` and `status` are server-managed and never accepted from API clients.

Reminder state is limited to `pending`, `processed`, and `cancelled`. A database
check constraint keeps `processed_at` consistent with `status`. Partial unique
indexes prevent duplicate pending automatic reminders and duplicate manual
reminders at the same instant.

### Automatic due-date reminders are derived state

Automatic reminders are a projection of Todo `due_at`, not an independently
editable resource. Todo create/update synchronizes them inside the Todo
transaction. Clearing the due date cancels only automatic reminders; completing
the Todo cancels all pending reminders.

### Notification snapshots and history

Notifications copy `title` and `message` at delivery time. `todo_id` and
`reminder_id` use `ON DELETE SET NULL` so inbox history survives Todo or
reminder deletion. A unique constraint on `reminder_id` provides exactly-once
notification creation.

### Worker transactions and isolation

The worker claims one batch per transaction with `FOR UPDATE SKIP LOCKED` and
uses a savepoint per reminder. A malformed record cannot abort the batch, and a
failed reminder stays pending for a later poll. Duplicate insert races are
reconciled using the existing notification.

### Signed notification cursors

Notification cursors are HMAC-SHA256 signed and bound to the user and the active
`is_read` filter. This prevents cursor tampering and cross-user or cross-filter
reuse. The implementation shares the cursor helper in `app/common/cursor.py`.

### Injectable clock

Reminder logic accepts a `Clock` callable instead of calling `datetime.now`
directly. This keeps time-based tests deterministic and makes the worker and API
use the same UTC semantics.

### User timezone is authoritative for Todo calendar views

The due-date logic follows the user timezone rather than server timezone. This is essential for Today, Upcoming, Overdue calculations and reduces future user confusion.

### Access controls are backend-only

The system assumes that authorization is never trusted from the client alone. The backend checks workspace membership and role permissions for every protected operation.

## Assumptions and derived decisions

- If a requirement is ambiguous, the simplest consistent solution is chosen.
- Todo movement between workspaces is not supported in the initial scope.
- Notification generation is internal to the same app and database-backed.
- Invitation acceptance is tied to the invited email and authenticated account.
- The monolith is the preferred deployment unit for this application while preserving module boundaries.
