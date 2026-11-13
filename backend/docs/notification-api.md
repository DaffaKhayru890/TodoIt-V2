# Notification API

Base path: `/api/v1`. All endpoints require a valid access token.

Notifications are always scoped to the authenticated user. The API never accepts
a `user_id` query parameter or body field for notification ownership.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List the current user's notifications |
| `GET` | `/notifications/{notification_id}` | Get one notification |
| `POST` | `/notifications/{notification_id}/read` | Mark one notification read |
| `POST` | `/notifications/read-all` | Mark all current user notifications read |

## List notifications

```http
GET /api/v1/notifications?is_read=false&limit=20&cursor=<opaque>
Authorization: Bearer <access-token>
```

### Query parameters

| Parameter | Type | Default | Rules |
|---|---|---|---|
| `is_read` | boolean | omitted | Omit to return read and unread |
| `limit` | integer | 20 | 1–100 |
| `cursor` | string | omitted | Signed cursor from `page.next_cursor` |

### Response

```json
{
  "items": [
    {
      "id": "7e4f0e0e-2e8d-4b4b-9f1e-9f8b2f6b8a6f",
      "user_id": "b1f8b5f0-4d0b-4f2f-9f8b-2f6b8a6f6f10",
      "todo_id": "6a8f5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
      "reminder_id": "0f8b5f0e-4d0b-4f2f-9f8b-2f6b8a6f6f10",
      "title": "Upcoming Todo Due Date",
      "message": "Your Todo is approaching its due date: Finish backend project",
      "type": "due_date_reminder",
      "is_read": false,
      "read_at": null,
      "created_at": "2026-11-13T10:00:00Z"
    }
  ],
  "page": {
    "limit": 20,
    "next_cursor": "eyJjcmVhdGVkX2F0Ijoi...",
    "has_more": true
  }
}
```

Ordering is `created_at DESC, id DESC`. When `has_more` is true, pass
`page.next_cursor` as `cursor` on the next request. Do not construct cursors
manually.

### Cursor design

The cursor is opaque, URL-safe, and signed with HMAC-SHA256 using
`PAGINATION_CURSOR_SECRET`. Its payload contains:

- cursor version,
- the last item's `created_at` and `id`,
- the owning `user_id`,
- a hash of the active `is_read` filter.

The server rejects:

- malformed or unsigned cursors (`INVALID_NOTIFICATION_CURSOR`),
- tampered signatures (`NOTIFICATION_CURSOR_SIGNATURE_INVALID`),
- cursors issued for another user (`NOTIFICATION_CURSOR_USER_MISMATCH`),
- cursors used with a different filter (`INVALID_NOTIFICATION_CURSOR`).

## Get notification detail

```http
GET /api/v1/notifications/{notification_id}
Authorization: Bearer <access-token>
```

Returns the notification when it belongs to the caller. A notification owned by
another user returns 404 with `NOTIFICATION_NOT_FOUND`.

## Mark one notification read

```http
POST /api/v1/notifications/{notification_id}/read
Authorization: Bearer <access-token>
```

Returns the updated notification. The operation is idempotent: calling it again
returns the same `read_at` timestamp.

## Mark all notifications read

```http
POST /api/v1/notifications/read-all
Authorization: Bearer <access-token>
```

```json
{
  "updated_count": 3
}
```

Only the caller's unread notifications are updated. Already-read rows keep their
original `read_at`. A second call returns `{"updated_count": 0}`.

## Error envelope

All errors use the shared envelope:

```json
{
  "success": false,
  "error": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "Notification not found",
    "request_id": "8c4f..."
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | Missing or not owned by the caller |
| `INVALID_NOTIFICATION_CURSOR` | 400 | Malformed, unsupported, or filter-mismatched cursor |
| `NOTIFICATION_CURSOR_SIGNATURE_INVALID` | 400 | Cursor signature does not verify |
| `NOTIFICATION_CURSOR_USER_MISMATCH` | 400 | Cursor belongs to another user |
| `validation_error` | 422 | Invalid query parameter, such as `limit=0` |
| `unauthorized` | 401 | Missing or invalid access token |

## OpenAPI

The routes publish summaries, response examples, and status codes in the
generated schema:

- `GET /openapi.json`
- `GET /docs`
