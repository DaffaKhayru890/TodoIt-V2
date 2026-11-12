# Testing Strategy

## Objective

The backend must be validated through a layered testing approach. This includes unit tests for business logic and API/integration tests for endpoints, authorization, data integrity, and worker behavior. All tests must use an isolated PostgreSQL test database, not the development database.

## Test structure

```text
tests/
├── unit/
│   ├── test_auth_service.py
│   ├── test_workspace_service.py
│   ├── test_todo_filters.py
│   ├── test_reminder_logic.py
│   └── test_notification_idempotency.py
└── api/
    ├── test_auth_api.py
    ├── test_workspaces_api.py
    ├── test_todos_api.py
    ├── test_invitations_api.py
    ├── test_notifications_api.py
    └── test_permissions_api.py
```

## Testing stack

- pytest
- pytest-asyncio
- httpx
- PostgreSQL test database
- async database fixtures
- fake SMTP sender for invitation flows

## Test isolation

- Each test run uses a dedicated test database name or schema.
- Transactions or database rollback fixtures clean the state after each test.
- No tests depend on development credentials or local user data.
- Reset identity and sequence values at the start of test suite if needed.

## Unit tests

Unit tests should cover:
- password hashing and validation
- JWT creation and parsing
- refresh token rotation logic
- workspace role checks
- Todo date filtering logic
- reminder generation rules
- notification de-duplication logic

## API tests

API tests should validate:
- registration and login
- access token and refresh token rotation
- logout and logout-all behavior
- protected endpoint access
- workspace invitation lifecycle
- member permission rules
- Todo filters and due-date views
- pagination stability across page boundaries
- reminder triggering and notification read actions

## Key test scenarios

### Authentication
- invalid password
- expired JWT
- token type confusion
- refresh replay attack
- logout from current session
- logout from all sessions

### Workspace
- workspace CRUD
- cross-workspace denial
- invitation accept/reject lifecycle
- member role update and owner restrictions

### Todo
- Todo creation, update, delete
- status change and priority update
- due date and timezone handling
- today/upcoming/overdue logic
- combined SQL filters
- cursor pagination

### Reminder and Notification
- due reminder creation
- reminder cancellation
- no duplicate notifications
- worker processing concurrency safety
- mark read and read-all behavior

## Fixtures

Use fixtures for:
- authenticated users
- workspace creation
- member assignments
- sample Todo data with tags and labels
- reminder scenarios
- notification inbox states

## Coverage strategy

Target coverage for:
- auth logic and edge cases
- permissions and authorization rules
- key Todo filters and date logic
- reminder worker behavior
- API contracts and error states

Coverage should be used to validate critical flows, not as a goal for trivial accessors or pure schema constants.

## CI expectations

- Test suite runs against database service in isolated environment.
- `test` target in Docker should execute the test suite automatically.
- API and permission tests must be part of the required pass conditions.
- Worker idempotency tests must verify no duplicate notifications under concurrent claim attempts.
