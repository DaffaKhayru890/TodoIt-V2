# Project Structure Design

## Final structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py
│   │   ├── main.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       └── routes/
│   │           ├── auth.py
│   │           ├── users.py
│   │           ├── workspaces.py
│   │           ├── todos.py
│   │           ├── tags.py
│   │           ├── labels.py
│   │           ├── reminders.py
│   │           └── notifications.py
│   │
│   ├── common/
│   │   ├── __init__.py
│   │   ├── enums.py
│   │   ├── pagination.py
│   │   ├── responses.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── datetime.py
│   │       └── strings.py
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   ├── logging.py
│   │   └── deps.py
│   │
│   └── services/
│       ├── auth/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── auth.py
│       │   └── controllers/
│       │       └── auth.py
│       │
│       ├── users/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── users.py
│       │   └── controllers/
│       │       └── users.py
│       │
│       ├── workspaces/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── workspaces.py
│       │   └── controllers/
│       │       └── workspaces.py
│       │
│       ├── todos/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── todos.py
│       │   └── controllers/
│       │       └── todos.py
│       │
│       ├── tags/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── tags.py
│       │   └── controllers/
│       │       └── tags.py
│       │
│       ├── labels/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── labels.py
│       │   └── controllers/
│       │       └── labels.py
│       │
│       ├── reminders/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   ├── schemas.py
│       │   ├── repository.py
│       │   ├── service.py
│       │   ├── routes/
│       │   │   └── reminders.py
│       │   └── controllers/
│       │       └── reminders.py
│       │
│       └── notifications/
│           ├── __init__.py
│           ├── models.py
│           ├── schemas.py
│           ├── repository.py
│           ├── service.py
│           ├── routes/
│           │   └── notifications.py
│           └── controllers/
│               └── notifications.py
│
├── migrations/
│   └── versions/
├── tests/
│   ├── unit/
│   └── api/
├── docs/
│   ├── README.md
│   ├── implementation-plan.md
│   ├── requirement-analysis.md
│   ├── architecture.md
│   ├── project-structure.md
│   ├── database-design.md
│   ├── api-design.md
│   ├── authentication-design.md
│   ├── authorization-design.md
│   ├── reminder-notification-design.md
│   ├── docker-deployment-design.md
│   ├── testing-strategy.md
│   └── technical-decisions.md
├── scripts/
│   └── init-db.sh
├── Dockerfile
├── compose.yaml
├── compose.production.yaml
├── pyproject.toml
├── uv.lock
├── alembic.ini
├── .dockerignore
├── .gitignore
├── README.md
└── .env.development.example
```

## Why this structure

- It is simple enough for a modular monolith.
- Each business domain has clear ownership.
- It avoids deep nested packages that reduce readability.
- It keeps the service-specific models, schemas, and repository logic near the domain they serve.
- It separates API entry points from domain logic.

## Folder-level responsibilities

### `app/api`
- HTTP bootstrapping.
- Middleware registration.
- Dependency injection setup.
- Router aggregation.

### `app/core`
- infrastructure concerns and shared frameworks.
- settings and secrets.
- database sessions and security primitives.

### `app/common`
- truly reusable helpers and common contracts.
- not a place for business logic.

### `app/services`
- each service owns a domain’s data and workflows.
- each service acts as a self-contained module with its own repository and schemas.

### `migrations`
- versioned SQLAlchemy schema evolution.
- managed by Alembic.

### `tests`
- unit tests for domain logic.
- API tests for end-to-end integration and permission checks.

### `docs`
- design, planning, and implementation review documentation.

### `scripts`
- operational tasks and helper scripts.

## Rule of scope

This phase creates documentation only. The physical structure above is the planned structure for future implementation, not a requirement to create full source code in Phase 0.
