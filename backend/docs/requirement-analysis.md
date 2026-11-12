# Requirement Analysis

## Requirement identifiers

The project will use stable identifiers throughout planning and implementation:

- `AUTH-*` for authentication and user account requirements.
- `USER-*` for profile and user lifecycle requirements.
- `WORKSPACE-*` for workspace and collaboration requirements.
- `TODO-*` for Todo management and productivity requirements.
- `REMINDER-*` for reminder scheduling requirements.
- `NOTIF-*` for notification requirements.
- `API-*` for API contract requirements.
- `OPS-*` for deployment and operational requirements.

## Authentication and user requirements

### AUTH-001
User registration must accept email, password, full name, timezone, and optional profile metadata.

### AUTH-002
User email must be unique and validated at both schema and database level.

### AUTH-003
Passwords must be hashed with Argon2 before persistence.

### AUTH-004
The system must issue access tokens and refresh tokens with expiry values controlled by environment variables.

### AUTH-005
Access token TTL: default 15 minutes.

### AUTH-006
Refresh token TTL: default 7 days.

### AUTH-007
Refresh tokens must be rotated on use and invalidated after replay detection.

### AUTH-008
Users must be able to log out from the current session and all sessions.

### AUTH-009
JWT claims must distinguish token types and reject token-type confusion.

### AUTH-010
Refresh sessions must be stored in PostgreSQL using hashed token values rather than raw tokens.

### AUTH-011
Users must retrieve current profile data using authenticated access tokens.

### USER-001
Each user must store an internal UUID, email, full name, timezone, password hash, status, and timestamps.

### USER-002
User timezone must use IANA timezone names such as `Asia/Jakarta` and be used for due-date interpretation.

## Workspace requirements

### WORKSPACE-001
A user may own multiple workspaces and participate in multiple workspaces as a member.

### WORKSPACE-002
Workspaces must include name, description, owner, and membership metadata.

### WORKSPACE-003
A workspace may contain many members, tasks, tags, and labels.

### WORKSPACE-004
Workspace ownership must remain valid and cannot be silently lost.

### WORKSPACE-005
Workspace deletion should use archive or soft-delete semantics to preserve historical references.

### WORKSPACE-006
Workspace members must have role-based permissions.

### WORKSPACE-007
A workspace invitation must be specific to the invited email and accept only by the matching user.

### WORKSPACE-008
Invitations must support pending, accepted, revoked, and expired states.

### WORKSPACE-009
Invitation tokens must be unpredictable, single-use, time-bounded, and hash-based.

### WORKSPACE-010
The system must support workspace sharing via email and a simple SMTP abstraction for testing.

## Todo requirements

### TODO-001
Every Todo must belong to exactly one workspace.

### TODO-002
Todo fields include workspace_id, created_by, title, description, status, priority, due_at, completed_at, created_at, and updated_at.

### TODO-003
Todo status values: `todo`, `in_progress`, `completed`.

### TODO-004
Todo priority values: `low`, `medium`, `high`, `urgent` with default `medium`.

### TODO-005
Todos may optionally have a due date and a timezone-aware due-date interpretation.

### TODO-006
Todo can be created, updated, deleted, completed, reopened, and reassigned with authorization checks.

### TODO-007
Todo list endpoints must support search, status filter, priority filter, tag filter, label filter, due-date views, and combined filters.

### TODO-008
Today view must use the user's local day boundaries and convert to UTC internally.

### TODO-009
Upcoming view must show tasks in the next 7 days excluding completed work.

### TODO-010
Overdue view must include only incomplete tasks whose due date is in the past.

### TODO-011
Todo list pagination must use cursor-based keyset pagination with stable ordering and an opaque cursor.

### TODO-012
Todo movement between workspaces is not required and should be explicitly disallowed unless a later requirement justifies it.

## Tag and label requirements

### TODO-013
Tags are workspace-scoped keywords with many-to-many relations to Todo items.

### TODO-014
Tag names must be unique within a workspace.

### TODO-015
Labels are workspace-scoped categories with a name and color.

### TODO-016
Label names must be unique within a workspace and color must be valid.

### TODO-017
A Todo can have many tags and labels, and the same tag/label can be shared across many Todos.

## Reminder requirements

### REMINDER-001
A reminder belongs to one Todo and one user and stores a reminder time.

### REMINDER-002
Reminder timestamps are stored in UTC while evaluation respects user timezone.

### REMINDER-003
The default automatic reminder is 60 minutes before due date.

### REMINDER-004
Automatic reminders are only created when Todo has a due date.

### REMINDER-005
If due date changes, pending automatic reminders must be recalculated or updated appropriately.

### REMINDER-006
When a Todo is completed or deleted, reminder lifecycle must be handled safely.

## Notification requirements

### NOTIF-001
Notifications are stored in PostgreSQL and linked to a user, optional Todo, and optional reminder.

### NOTIF-002
Notifications must include a title, message, type, read state, and timestamp metadata.

### NOTIF-003
Notifications are personal and must never be visible to other users.

### NOTIF-004
Notification processing must be idempotent and safe under concurrent worker execution.

### NOTIF-005
Notification creation must not duplicate work for a processed reminder.

## API requirements

### API-001
All APIs are versioned under `/api/v1`.

### API-002
Each endpoint must define HTTP method, path, auth requirement, request contract, response contract, and status codes.

### API-003
All API error responses must use a standard error envelope instead of raw database exceptions.

### API-004
OpenAPI documentation must expose Swagger UI, ReDoc, and JSON schema output.

### API-005
Pagination responses must use an object with items and page metadata.

## Operational and deployment requirements

### OPS-001
The application must support `development`, `test`, `staging`, and `production` environments.

### OPS-002
Environment-specific configuration must come from `.env.*` files and pydantic-settings.

### OPS-003
Docker multi-stage builds are required with `base`, `development`, `test`, and `production` targets.

### OPS-004
The API and notification worker share the same codebase and image.

### OPS-005
PostgreSQL must be backed by persistent storage and health checks.

### OPS-006
Production configuration must use non-root execution and secure secret management.

## Functional assumptions

- Workspace roles are limited to `owner`, `admin`, and `member`.
- Only workspace members may access workspace resources.
- Todo filters are performed in SQL rather than in Python memory.
- Cursor pagination is the primary pagination mechanism; offset pagination is not the default strategy.
- The system prefers a single modular codebase with clear service boundaries instead of distributed microservices.
