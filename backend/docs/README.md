# TodoIt V2 Backend Planning

This directory contains the Phase 0 technical planning for the Todo workspace collaboration backend. The design follows a modular monolith approach and is intentionally limited to planning and documentation.

## Reading order

1. `requirement-analysis.md` – business and technical requirements grouped by module.
2. `implementation-plan.md` – delivery phases, dependencies, and scope.
3. `architecture.md` – system design, modular boundaries, and lifecycle flow.
4. `project-structure.md` – final folder structure and responsibilities.
5. `database-design.md` – entities, relationships, constraints, and indexing.
6. `api-design.md` – endpoint inventory, schemas, statuses, and unified response contract.
7. `authentication-design.md` – auth flow, JWT, refresh rotation, and cookie security.
8. `authorization-design.md` – roles, workspace membership, and IDOR prevention.
9. `reminder-notification-design.md` – reminder lifecycle and worker behavior.
10. `docker-deployment-design.md` – container strategy and deployment concerns.
11. `testing-strategy.md` – lab test architecture for unit and API validation.
12. `technical-decisions.md` – key design choices and rationale.

## Scope of this phase

Phase 0 intentionally does not implement application code. The output is a technical foundation for the later implementation phases.

## Project goal

Build a secure, maintainable backend for a collaborative Todo application with workspaces, members, sharing invitations, productivity filtering, reminders, and database-backed notifications.
