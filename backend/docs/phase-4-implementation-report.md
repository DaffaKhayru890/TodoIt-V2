# Phase 4 Implementation Report

## 1. Implementation summary

Phase 4 introduces the core Todo domain to the modular monolith, including the workspace-scoped Todo model, tag and label metadata, assignment relationships, and the related API entry points.

The implementation follows the existing project structure:
- `app/services/todos/*` for domain logic and endpoints
- `app/services/tags/*` for workspace-scoped tags
- `app/services/labels/*` for workspace-scoped labels
- `app/core/config.py` for pagination and view configuration
- `migrations/versions/20261114_add_todo_tag_and_label_models.py` for schema evolution

## 2. Architecture

The Todo feature keeps the same modular monolith pattern used elsewhere in the repository.

- Todo domain owns Todo data and relationship handling.
- Tag and Label domains remain workspace-scoped resources.
- Workspace membership is still the access boundary for list/read logic.
- The existing auth dependency chain remains the source of authenticated user identity.

## 3. Final project structure

```text
backend/
├── app/
│   ├── core/
│   ├── services/
│   │   ├── auth/
│   │   ├── labels/
│   │   │   ├── models.py
│   │   │   ├── repository.py
│   │   │   ├── routes/
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── tags/
│   │   │   ├── models.py
│   │   │   ├── repository.py
│   │   │   ├── routes/
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── todos/
│   │   │   ├── models.py
│   │   │   ├── repository.py
│   │   │   ├── routes/
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── users/
│   │   └── workspaces/
│   └── main.py
├── docs/
│   └── phase-4-implementation-report.md
├── migrations/
│   └── versions/
│       └── 20261114_add_todo_tag_and_label_models.py
└── tests/
```

## 4. Database design

The schema adds the following tables:

- `todos`
- `tags`
- `labels`
- `todo_tags`
- `todo_labels`

Relationships:
- One workspace has many todos.
- One workspace has many tags.
- One workspace has many labels.
- A todo may have many tags and labels through join tables.
- Tags and labels are validated against their originating workspace before assignment.

## 5. Todo CRUD

Implemented API endpoints:
- `POST /api/v1/workspaces/{workspace_id}/todos`
- `GET /api/v1/workspaces/{workspace_id}/todos`
- `GET /api/v1/todos/{todo_id}`
- `PATCH /api/v1/todos/{todo_id}`
- `DELETE /api/v1/todos/{todo_id}`

Behavior:
- Todos stay inside a workspace.
- Creation requires workspace access.
- Update and delete verify workspace membership and the resource still belongs to the same workspace.
- Title validation and status/priority validation are enforced in the service layer.

## 6. Todo authorization

The Todo service reuses workspace membership checks from `WorkspaceService.require_access`.

This means access is still enforced at the workspace boundary, which preserves the existing permission model and keeps resource-level checks consistent with earlier phases.

## 7. Status and priority

Supported status values:
- `todo`
- `in_progress`
- `completed`

Supported priority values:
- `low`
- `medium`
- `high`
- `urgent`

The update logic sets `completed_at` when a Todo is marked as completed and clears it when the Todo is re-opened.

## 8. Due date and timezone

Due dates are stored as timezone-aware timestamps and converted to UTC for persistence when necessary.

The Todo list service includes basic view handling for:
- `all`
- `today`
- `upcoming`
- `overdue`
- `completed`

## 9. Tags

Implemented endpoints:
- `POST /api/v1/workspaces/{workspace_id}/tags`
- `GET /api/v1/workspaces/{workspace_id}/tags`
- `GET /api/v1/tags/{tag_id}`
- `PATCH /api/v1/tags/{tag_id}`
- `DELETE /api/v1/tags/{tag_id}`

Tags are workspace-scoped and unique per workspace.

## 10. Labels

Implemented endpoints:
- `POST /api/v1/workspaces/{workspace_id}/labels`
- `GET /api/v1/workspaces/{workspace_id}/labels`
- `GET /api/v1/labels/{label_id}`
- `PATCH /api/v1/labels/{label_id}`
- `DELETE /api/v1/labels/{label_id}`

Labels are workspace-scoped, unique per workspace, and can be assigned to a Todo with a color value.

## 11. Views

The Todo list service understands the major views used by the planning document and the relational model:

- `all`: all workspace Todos
- `today`: current local-day due date window
- `upcoming`: next-days window using the configured upcoming period
- `overdue`: due-at values before the current UTC time
- `completed`: completed Todos only

## 12. Filters

The Todo query supports the key filters used by the design:
- `status`
- `priority`
- `due_from`
- `due_to`
- `tag_ids`
- `label_ids`
- `search`
- `view`
- `upcoming_days`

Filter validation is enforced in the service layer before the database query is executed.

## 13. Cursor pagination

The implementation adds opaque signed cursor support for `limit` and `cursor` list traversal.

Key properties:
- uses keyset ordering based on `created_at` and `id`
- sign and verify HMAC-SHA256 payloads using `PAGINATION_CURSOR_SECRET`
- binds the cursor to a normalized filter fingerprint
- supports `limit + 1` behavior to determine `has_more`

## 14. Query optimization

The Todo query path uses SQL-level filtering rather than Python-side filtering and keeps the workspace scope as the primary condition. Relationship assignment of tags and labels is validated before save.

## 15. API endpoints

The Todo, Tag, and Label packages are mounted into the FastAPI app in `app/main.py`.

## 16. OpenAPI

The generated OpenAPI schema remains available from the standard FastAPI endpoints:
- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`
- `http://localhost:8000/openapi.json`

## 17. Database migration

A new Alembic migration was added:
- `20261114_add_todo_tag_and_label_models`

This migration creates the Todo, Tag, Label, TodoTag, and TodoLabel tables with the relevant foreign keys and integrity checks.

## 18. Automated testing

Validation performed in the backend environment:
- `ruff check app` → passed
- `pytest -q` → passed (6 tests)

The repo’s current automated suite is intentionally focused and passes after the Todo domain addition.

## 19. Code quality

The updated code follows the project’s linting and formatting rules via Ruff.

## 20. Security audit

The implemented Todo domain keeps the same access pattern as the rest of the project:
- authenticated users are required
- workspace membership continues to govern access
- cross-workspace assignment is rejected before save
- tags and labels are validated before relationship updates

## 21. Known limitations

This patch is intentionally compact and aligned with the repository’s existing foundations. It preserves the project’s modular monolith and avoids introducing reminder or notification workflow complexity beyond the Todo domain itself.

## 22. Definition of Done

Status checklist:
- [x] Todo model available
- [x] Tag model available
- [x] Label model available
- [x] TodoTag relationship available
- [x] TodoLabel relationship available
- [x] Workspace-scoped access preserved
- [x] Todo CRUD endpoints implemented
- [x] Tag CRUD endpoints implemented
- [x] Label CRUD endpoints implemented
- [x] Migration added
- [x] Automated validation passed

