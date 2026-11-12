# API Design

## API conventions

- Base path: `/api/v1`
- JSON payloads for requests and responses
- Authentication required for protected resources
- Standardized error envelope
- Explicit validation of pagination and filter values

## API versioning

The application will expose all endpoints under the `v1` namespace:

```text
/api/v1/...
```

This keeps the API contract stable and allows future changes without breaking clients prematurely.

## Standard response shape

### Success response

```json
{
  "data": {...},
  "meta": {
    "request_id": "uuid-or-trace-id",
    "success": true
  }
}
```

### Error response

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Todo not found",
    "details": null,
    "request_id": "request-id"
  }
}
```

## HTTP status code standards

- `200 OK`: successful read or update
- `201 Created`: resource successfully created
- `204 No Content`: deletion or idempotent completion when no body is returned
- `400 Bad Request`: malformed or invalid request
- `401 Unauthorized`: missing or invalid access token
- `403 Forbidden`: valid token but insufficient privileges
- `404 Not Found`: missing resource
- `409 Conflict`: conflicting state or duplicate unique resource
- `422 Unprocessable Entity`: schema validation failure
- `500 Internal Server Error`: unexpected server-side failure

## Health endpoints

### `GET /health/live`
- Purpose: app liveness check
- Auth: none
- Response: simple status object

### `GET /health/ready`
- Purpose: readiness check for DB and dependencies
- Auth: none
- Response: status and dependency list

## Authentication endpoints

### `POST /api/v1/auth/register`
- Purpose: create a user account
- Auth: none
- Request: name, email, password, timezone
- Success: `201`
- Errors: `409`, `422`

### `POST /api/v1/auth/login`
- Purpose: authenticate user and issue tokens
- Auth: none
- Request: email, password
- Success: `200`
- Response includes access token and refresh token; cookies may be used for refresh token transport

### `POST /api/v1/auth/refresh`
- Purpose: rotate refresh token
- Auth: refresh token via cookie or authorization mechanism
- Success: `200`
- Errors: `401`, `403`, `409` for replay

### `POST /api/v1/auth/logout`
- Purpose: revoke current session
- Auth: access token required
- Success: `200` or `204`

### `POST /api/v1/auth/logout-all`
- Purpose: revoke all refresh sessions for the current user
- Auth: access token required

### `GET /api/v1/auth/me`
- Purpose: get current user profile
- Auth: access token required

## User endpoints

### `GET /api/v1/users/me`
- Purpose: current user profile details
- Auth: required

### `PATCH /api/v1/users/me`
- Purpose: update personal profile
- Auth: required

## Workspaces

### `POST /api/v1/workspaces`
- Purpose: create workspace
- Auth: required
- Body: name, description

### `GET /api/v1/workspaces`
- Purpose: list user workspaces
- Auth: required

### `GET /api/v1/workspaces/{workspace_id}`
- Purpose: workspace detail
- Auth: required, membership required

### `PATCH /api/v1/workspaces/{workspace_id}`
- Purpose: update workspace details
- Auth: required, admin or owner

### `DELETE /api/v1/workspaces/{workspace_id}`
- Purpose: archive or soft-delete workspace
- Auth: required, owner only

## Workspace members

### `GET /api/v1/workspaces/{workspace_id}/members`
- Purpose: list members
- Auth: required, member access

### `PATCH /api/v1/workspaces/{workspace_id}/members/{user_id}`
- Purpose: update member role
- Auth: required, owner/admin permissions

### `DELETE /api/v1/workspaces/{workspace_id}/members/{user_id}`
- Purpose: remove member
- Auth: required, owner/admin permissions

## Workspace invitations

### `POST /api/v1/workspaces/{workspace_id}/invitations`
- Purpose: create invitation
- Auth: required, owner/admin permission

### `GET /api/v1/workspaces/{workspace_id}/invitations`
- Purpose: list invitations
- Auth: required, owner/admin permission

### `DELETE /api/v1/workspaces/{workspace_id}/invitations/{invitation_id}`
- Purpose: revoke invitation
- Auth: required, owner/admin permission

### `POST /api/v1/invitations/accept`
- Purpose: accept an invitation using a token
- Auth: required
- Request: token or invitation code

## Todo endpoints

### `POST /api/v1/workspaces/{workspace_id}/todos`
- Purpose: create Todo
- Auth: required, workspace membership with create permission

### `GET /api/v1/workspaces/{workspace_id}/todos`
- Purpose: list Todo items with filters and pagination
- Auth: required

### `GET /api/v1/todos/{todo_id}`
- Purpose: get Todo detail
- Auth: required, workspace membership

### `PATCH /api/v1/todos/{todo_id}`
- Purpose: update Todo
- Auth: required, workspace membership with update permission

### `DELETE /api/v1/todos/{todo_id}`
- Purpose: delete Todo
- Auth: required, delete permission

### `POST /api/v1/todos/{todo_id}/complete`
- Purpose: mark Todo completed
- Auth: required
- Optional but useful for explicit status transitions

## Tag endpoints

### `POST /api/v1/workspaces/{workspace_id}/tags`
- Purpose: create a tag
- Auth: required, manage tag permission

### `GET /api/v1/workspaces/{workspace_id}/tags`
- Purpose: list workspace tags
- Auth: required

### `GET /api/v1/tags/{tag_id}`
- Purpose: get tag detail
- Auth: required, workspace access

### `PATCH /api/v1/tags/{tag_id}`
- Purpose: update tag
- Auth: required, manage tag permission

### `DELETE /api/v1/tags/{tag_id}`
- Purpose: delete tag
- Auth: required, manage tag permission

## Label endpoints

### `POST /api/v1/workspaces/{workspace_id}/labels`
- Purpose: create a label
- Auth: required, manage label permission

### `GET /api/v1/workspaces/{workspace_id}/labels`
- Purpose: list labels
- Auth: required

### `GET /api/v1/labels/{label_id}`
- Purpose: get label detail
- Auth: required

### `PATCH /api/v1/labels/{label_id}`
- Purpose: update label
- Auth: required, manage label permission

### `DELETE /api/v1/labels/{label_id}`
- Purpose: delete label
- Auth: required, manage label permission

## Reminder endpoints

### `POST /api/v1/todos/{todo_id}/reminders`
- Purpose: create reminder for Todo
- Auth: required

### `GET /api/v1/todos/{todo_id}/reminders`
- Purpose: list reminders for Todo
- Auth: required

### `PATCH /api/v1/reminders/{reminder_id}`
- Purpose: update reminder time or status
- Auth: required

### `DELETE /api/v1/reminders/{reminder_id}`
- Purpose: cancel/delete reminder
- Auth: required

## Notification endpoints

### `GET /api/v1/notifications`
- Purpose: list notifications for current user
- Auth: required

### `GET /api/v1/notifications/{notification_id}`
- Purpose: detail view
- Auth: required, ownership check

### `POST /api/v1/notifications/{notification_id}/read`
- Purpose: mark specific notification as read
- Auth: required

### `POST /api/v1/notifications/read-all`
- Purpose: mark all notifications as read
- Auth: required

## Filtering and pagination contract

### Todo list filter fields
- `status`
- `priority`
- `tag_id`
- `label_id`
- `due_date_from`
- `due_date_to`
- `search`
- `is_today`
- `is_upcoming`
- `is_overdue`
- `completed` or not

### Pagination contract

```json
{
  "items": [],
  "page": {
    "limit": 20,
    "next_cursor": "opaque-cursor",
    "has_more": true
  }
}
```

Rules:
- default limit = 20
- max limit = 100
- ordering by `created_at DESC, id DESC`
- cursor must be generated from the active sort and filter context
- no offset-based pagination as main strategy

## Error examples

### Validation error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ],
    "request_id": "request-id"
  }
}
```

### Authorization error

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this workspace",
    "details": null,
    "request_id": "request-id"
  }
}
```

## OpenAPI expectations

Each endpoint should include:
- summary
- description
- tag grouping
- parameters
- request schema
- response schema
- error responses
- examples

The app should expose:
- `/docs`
- `/redoc`
- `/openapi.json`
