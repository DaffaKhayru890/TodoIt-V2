# TodoIt Backend — Todo List API (Golang Modular Monolith)

Dokumen ini adalah **hasil Phase 0: Analysis & Technical Planning** untuk backend TodoIt.
Belum ada source code aplikasi, HTTP handler, GORM model, migration SQL, Dockerfile, maupun
implementasi worker pada tahap ini. Seluruh isi folder `backend/` saat ini adalah dokumen
perencanaan teknis yang menjadi acuan Phase 1 dan seterusnya.

## Ringkasan Proyek

TodoIt adalah backend Todo List kolaboratif berbasis **workspace**. Setiap workspace memiliki
anggota dengan role `OWNER`, `ADMIN`, dan `MEMBER`. Di dalam workspace terdapat task yang dapat
diberi tag, label, due date, reminder, dan menghasilkan notifikasi in-app.

| Aspek | Keputusan |
|---|---|
| Bahasa | Go (target Go 1.24+, dipin ke versi stabil saat Phase 1) |
| HTTP framework | Gin |
| ORM | GORM (PostgreSQL driver) |
| Database | PostgreSQL 16 |
| Autentikasi | JWT access token + opaque refresh token dengan rotasi |
| Password | bcrypt (cost 12) |
| Migrasi | Goose |
| Validasi | go-playground/validator |
| Dokumentasi API | OpenAPI 3.0.3 + Swagger UI |
| Testing | `testing` + Testify + `httptest` + PostgreSQL integration test |
| Logging | `log/slog` (structured JSON) |
| Arsitektur | Modular Monolith, satu proses deploy |
| Container | Docker multi-stage + Docker Compose |

## Struktur Repository (rencana)

```text
backend/
├── cmd/api/main.go
├── internal/
│   ├── config/ database/ middleware/ shared/
│   ├── auth/ users/ workspaces/ tasks/
│   └── tags/ labels/ reminders/ notifications/
├── migrations/
├── docs/
├── tests/
├── scripts/
└── (Dockerfile, compose, env example, go.mod dibuat pada Phase 1)
```

Detail lengkap: [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md).

## Peta Dokumentasi

### Fondasi & Arsitektur

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — gambaran sistem, konteks, dan prinsip.
- [`docs/architecture/modular-monolith.md`](docs/architecture/modular-monolith.md) — aturan modul, komunikasi, transaksi, worker.
- [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md) — struktur final folder dan file.
- [`docs/architecture/module-dependencies.md`](docs/architecture/module-dependencies.md) — dependency graph dan aturan anti-circular.
- [`docs/architecture/domain-analysis.md`](docs/architecture/domain-analysis.md) — analisis 15 domain kebutuhan.
- [`docs/architecture/authentication-flow.md`](docs/architecture/authentication-flow.md) — register, login, refresh rotation, logout.
- [`docs/architecture/workspace-authorization.md`](docs/architecture/workspace-authorization.md) — RBAC workspace dan permission matrix.
- [`docs/architecture/timezone-handling.md`](docs/architecture/timezone-handling.md) — Today/Upcoming/Overdue dan DST.
- [`docs/architecture/notification-worker.md`](docs/architecture/notification-worker.md) — reminder worker, locking, idempotensi.

### Database

- [`docs/database/database-design.md`](docs/database/database-design.md) — desain tabel, kolom, constraint, cascade.
- [`docs/database/entity-relationship.md`](docs/database/entity-relationship.md) — ERD Mermaid.
- [`docs/database/index-strategy.md`](docs/database/index-strategy.md) — index, composite, partial, alasan.
- [`docs/database/migrations.md`](docs/database/migrations.md) — urutan migration Goose dan strategi rollout.

### API

- [`docs/api/api-overview.md`](docs/api/api-overview.md) — konvensi umum, versi, auth, health.
- [`docs/api/endpoint-planning.md`](docs/api/endpoint-planning.md) — 47 endpoint lengkap dengan kontrak.
- [`docs/api/response-convention.md`](docs/api/response-convention.md) — envelope sukses & pagination.
- [`docs/api/error-convention.md`](docs/api/error-convention.md) — error code, status mapping, validasi.
- [`docs/api/cursor-pagination.md`](docs/api/cursor-pagination.md) — cursor opaque, sorting, tie-breaker, index.

### Development & Deployment

- [`docs/development/docker-development.md`](docs/development/docker-development.md) — hot reload, compose dev.
- [`docs/development/testing-strategy.md`](docs/development/testing-strategy.md) — unit/integration/contract test.
- [`docs/deployment/docker-production.md`](docs/deployment/docker-production.md) — multi-stage, non-root, health check.
- [`docs/deployment/environment-strategy.md`](docs/deployment/environment-strategy.md) — env per environment & secret manager.

### Roadmap

- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md) — Phase 0 sampai Phase 9.
- [`docs/README.md`](docs/README.md) — indeks dokumentasi.

## Konfigurasi Development (ringkas)

```env
APP_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USER=root
DB_PASSWORD=dev@123
DB_NAME=todolist
DB_SSLMODE=disable
```

Kredensial di atas **hanya untuk development lokal**. Staging dan production wajib memakai
credential terpisah dari environment variable/secret manager. Detail:
[`docs/deployment/environment-strategy.md`](docs/deployment/environment-strategy.md).

## Status

- Phase 0: **selesai (dokumentasi)**.
- Phase 1 dan seterusnya: **belum dikerjakan**, menunggu instruksi eksplisit.
