# Implementation Plan

## Overview

This project is a modular monolith backend for a collaborative Todo app. It is intentionally simpler than a distributed architecture while keeping business domains separated into independent modules.

## Project goals

- Build a secure authentication layer with JWT access and refresh token lifecycle management.
- Support workspace-based collaboration with members, roles, ownership, and invitations.
- Manage Todo items with tags, labels, due dates, status, and productivity filters.
- Support cursor-based list pagination for scalable Todo retrieval.
- Provide reminder scheduling and persistent notification processing.
- Keep the service boundaries clean and maintainable without over-engineering.

## Feature scope

- User registration, login, logout, token refresh, and profile retrieval.
- Workspace creation, update, membership, permissions, and invitation flow.
- Todo CRUD, filtering, today/upcoming/overdue views, and keyset pagination.
- Tag and label management per workspace.
- Reminder scheduling and due-date automation.
- Notification storage and processing using a database-backed worker.
- Docker-based development and production deployment support.

## Technology stack

- Python 3.12+
- FastAPI
- SQLAlchemy 2.x (async API)
- PostgreSQL
- asyncpg
- Pydantic v2 + pydantic-settings
- Alembic
- JWT via PyJWT or equivalent
- Argon2 password hashing
- pytest + pytest-asyncio + httpx
- Ruff
- uv
- Docker / Docker Compose

## Phase planning

### Phase 0 — Project Analysis & Planning

Objective:
- Validate requirements and define architecture before implementation.

Scope:
- Requirements analysis, service module mapping, schema design, API blueprint, and deployment approach.

Dependencies:
- None

Files/modules:
- `docs/*.md`
- `backend/` project structure specification

Definition of Done:
- Requirements captured
- APIs defined
- Database model structure designed
- Environment and deployment strategy defined
- Implementation roadmap approved

### Phase 1 — Project Foundation & Infrastructure

Objective:
- Establish the project skeleton and infrastructure.

Scope:
- Python project initialization with uv
- FastAPI app bootstrap
- SQLAlchemy async config
- PostgreSQL configuration
- Alembic setup
- logging, exception handling, and base settings
- Docker multi-stage build setup
- health/live endpoints

Files/modules:
- `app/core/*`
- `app/common/*`
- `app/api/*`
- `migrations/*`
- `tests/*`
- `Dockerfile`, `compose.yaml`, `compose.production.yaml`

Definition of Done:
- App boots successfully in dev/test environments
- DB connection works
- Health endpoints respond correctly
- Migration tooling works

### Phase 2 — Authentication & User Management

Objective:
- Secure user lifecycle and token management.

Scope:
- User model and profile
- registration/login/logout
- access/refresh tokens
- refresh token rotation and revocation
- password hashing with Argon2
- profile retrieval and session validation

Files/modules:
- `app/services/auth/*`
- `app/services/users/*`

Definition of Done:
- Auth flows work with secure token handling
- Refresh replay protection implemented
- Logout all and revocation work as expected

### Phase 3 — Workspace & Collaboration

Objective:
- Support collaborative workspaces and membership access.

Scope:
- workspace CRUD
- workspace roles
- workspace membership
- invitation generation and acceptance
- email abstraction for invitation flow

Files/modules:
- `app/services/workspaces/*`

Definition of Done:
- Users can create, join, manage workspaces
- Invitation lifecycle works
- Permission rules enforced on all workspace resources

### Phase 4 — Todo Management & Productivity Features

Objective:
- Deliver core productivity and list management.

Scope:
- Todo CRUD
- status and priority handling
- tag and label models
- due-date aware filters
- today/upcoming/overdue logic
- keyset pagination
- search and combined filters

Files/modules:
- `app/services/todos/*`
- `app/services/tags/*`
- `app/services/labels/*`

Definition of Done:
- Todos can be created and managed in workspace scope
- Filters work in SQL layer
- Pagination is stable and duplicate-free
- Due-date views respect user timezone

### Phase 5 — Reminder & Notification System

Objective:
- Support scheduling and persistent notifications.

Scope:
- Reminder CRUD and lifecycle
- automatic due-date reminder generation
- in-app notification persistence
- worker processing with idempotency and locking
- restart recovery and graceful shutdown

Files/modules:
- `app/services/reminders/*`
- `app/services/notifications/*`

Definition of Done:
- Reminders trigger reliably
- Notifications are stored and visible to the correct user
- Worker does not create duplicates
- Processing survives restarts

### Phase 6 — Finalization & Production Deployment

Objective:
- Validate security, quality, and production readiness.

Scope:
- full test pass
- security and auth audits
- migration review
- API and docs audit
- deployment configuration review
- final production configuration

Files/modules:
- `tests/*`
- `docs/*`
- Docker and deployment config

Definition of Done:
- All tests pass
- Permission and access rules audited
- Deployment config is secure and explicit
- Documentation is final and complete

## Phase dependencies

- Phase 1 is foundational for all later implementation.
- Phase 2 must finish before workspace collaboration features rely on auth.
- Phase 3 provides the access boundary used by Todos, tags, labels, reminders, and notifications.
- Phase 4 depends on workspace membership and modeling.
- Phase 5 depends on Todo and reminder domain completion.
- Phase 6 depends on all previous phases.

## Definition of Done for Phase 0

- All major requirements are captured.
- Architectural decisions are documented.
- Database and API scopes are clear.
- The project structure is defined.
- The roadmap is agreed and executable.
- No production application code is created in this phase.
