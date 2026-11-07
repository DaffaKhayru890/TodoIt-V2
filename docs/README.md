# Dokumentasi Todo Backend

Dokumentasi ini menjelaskan backend aplikasi Todo List yang dibangun dengan arsitektur Clean Architecture dan Modular Monolith:
- **Phase 1**: Project setup, Clean Architecture, konfigurasi environment, koneksi PostgreSQL lewat Drizzle, OpenAPI Scalar, health endpoint, infrastruktur testing, dan Docker.
- **Phase 2**: Authentication Module (Register, Login, JWT, Refresh Token Rotation, Session Management, Logout, Me) dan Workspace Module (Ownership, Membership, Role-based Authorization Policy, Soft Archive).
- **Phase 3**: Todo Core Engine (CRUD, status/priority, due date, Today/Upcoming/Overdue, filter/pencarian, cursor pagination, soft delete, dan otorisasi workspace).
- **Phase 4**: Metadata Todo (Tag many-to-many, Label kategori tunggal, Reminder absolute/before_due). Pengiriman notifikasi belum termasuk.

Status implementasi: **Phase 4 selesai**.

## Urutan membaca

### 1. Arsitektur & Desain
| Dokumen | Deskripsi |
|---|---|
| [architecture/architecture-overview.md](architecture/architecture-overview.md) | Gambaran besar arsitektur, layer, dan arah dependency. |
| [architecture/clean-architecture.md](architecture/clean-architecture.md) | Tanggung jawab tiap layer dalam Clean Architecture. |
| [architecture/modular-monolith.md](architecture/modular-monolith.md) | Batas module dan pencegahan circular dependency. |
| [architecture/dependency-rules.md](architecture/dependency-rules.md) | Aturan dependensi antar layer dan module. |
| [architecture/authentication-architecture.md](architecture/authentication-architecture.md) | Arsitektur autentikasi lengkap dengan Mermaid sequence diagrams. |
| [architecture/authorization-architecture.md](architecture/authorization-architecture.md) | Arsitektur otorisasi, pemisahan peran, dan permission matrix. |
| [architecture/workspace-architecture.md](architecture/workspace-architecture.md) | Arsitektur workspace, kepemilikan, dan lifecycle soft archive. |
| [architecture/todo-architecture.md](architecture/todo-architecture.md) | Arsitektur Todo module: layer, port, authorization, error mapping, dan batas Phase 3. |
| [architecture/todo-metadata-architecture.md](architecture/todo-metadata-architecture.md) | Arsitektur Tag dan Label di dalam bounded context Todo. |
| [architecture/reminder-architecture.md](architecture/reminder-architecture.md) | Arsitektur jadwal Reminder dan pemisahannya dari pengiriman notifikasi. |
| [architecture/decisions/ADR-0001-architecture.md](architecture/decisions/ADR-0001-architecture.md) | ADR-0001: Pemilihan stack teknis dan arsitektur dasar. |
| [architecture/decisions/ADR-0002-authentication-strategy.md](architecture/decisions/ADR-0002-authentication-strategy.md) | ADR-0002: Strategi autentikasi dual token (JWT & Opaque Refresh). |
| [architecture/decisions/ADR-0003-token-rotation.md](architecture/decisions/ADR-0003-token-rotation.md) | ADR-0003: Token rotation dan deteksi reuse token. |
| [architecture/decisions/ADR-0004-workspace-ownership.md](architecture/decisions/ADR-0004-workspace-ownership.md) | ADR-0004: Workspace ownership, membership, dan anti-enumeration. |

### 2. Database & Skema
| Dokumen | Deskripsi |
|---|---|
| [database/database-setup.md](database/database-setup.md) | Setup database, connection pool, dan migration Drizzle. |
| [database/authentication-schema.md](database/authentication-schema.md) | Skema tabel users, auth_sessions, refresh_tokens dengan ERD Mermaid. |
| [database/workspace-schema.md](database/workspace-schema.md) | Skema tabel workspaces dan workspace_members dengan ERD Mermaid. |
| [database/todo-schema.md](database/todo-schema.md) | Skema tabel todos, constraint, partial index, soft delete, dan migration Phase 3. |
| [database/tag-schema.md](database/tag-schema.md) | Tabel tags, todo_tags, uniqueness, dan cascade. |
| [database/label-schema.md](database/label-schema.md) | Tabel labels dan `todos.label_id` dengan ON DELETE SET NULL. |
| [database/reminder-schema.md](database/reminder-schema.md) | Tabel reminders, check constraint, dan partial unique index. |

### 3. API & OpenAPI
| Dokumen | Deskripsi |
|---|---|
| [api/openapi.md](api/openapi.md) | Konvensi integrasi OpenAPI Scalar. |
| [api/authentication-api.md](api/authentication-api.md) | Dokumentasi endpoint autentikasi (/api/v1/auth). |
| [api/workspace-api.md](api/workspace-api.md) | Dokumentasi endpoint workspace (/api/v1/workspaces). |
| [api/todo-api.md](api/todo-api.md) | Dokumentasi lengkap endpoint Todo, filter, pagination, dan error. |
| [api/tag-api.md](api/tag-api.md) | Endpoint CRUD Tag dan assignment pada Todo. |
| [api/label-api.md](api/label-api.md) | Endpoint CRUD Label dan assignment pada Todo. |
| [api/reminder-api.md](api/reminder-api.md) | Endpoint jadwal Reminder: create, list, update, dan cancel. |

### 4. Fitur Todo
| Dokumen | Deskripsi |
|---|---|
| [features/todo-lifecycle.md](features/todo-lifecycle.md) | Siklus hidup, status, complete idempoten, dan soft delete. |
| [features/todo-priority.md](features/todo-priority.md) | Nilai priority, default, filter, dan batasannya. |
| [features/todo-date-management.md](features/todo-date-management.md) | Format dueAt, timezone, rentang hari, dan DST. |
| [features/today-view.md](features/today-view.md) | Definisi dan perilaku Today View. |
| [features/upcoming-view.md](features/upcoming-view.md) | Definisi dan rentang Upcoming View. |
| [features/overdue-view.md](features/overdue-view.md) | Definisi Overdue dan hubungannya dengan status. |
| [features/todo-filtering.md](features/todo-filtering.md) | Filter status/priority/tanggal dan pencarian q. |
| [features/cursor-pagination.md](features/cursor-pagination.md) | Keyset pagination, format cursor, dan fingerprint filter. |
| [features/tag-management.md](features/tag-management.md) | Aturan Tag, normalisasi nama, dan assignment. |
| [features/label-management.md](features/label-management.md) | Aturan Label, warna HEX, dan satu label per Todo. |
| [features/reminder-management.md](features/reminder-management.md) | Membuat, mengubah, menampilkan, dan membatalkan Reminder. |
| [features/reminder-scheduling-rules.md](features/reminder-scheduling-rules.md) | Absolute, before_due, effective time, dueAt, dan konkurensi. |
| [features/todo-metadata-integration.md](features/todo-metadata-integration.md) | Metadata pada response Todo, filter, dan fingerprint cursor. |

### 5. Keamanan
| Dokumen | Deskripsi |
|---|---|
| [security/password-security.md](security/password-security.md) | Argon2id hashing, timing equalization, dan password policy. |
| [security/jwt-security.md](security/jwt-security.md) | JWT access token, HS256, klaim minimal, dan secret validation. |
| [security/refresh-token-security.md](security/refresh-token-security.md) | 256-bit opaque token, SHA-256 hash storage, cookie security, dan CORS. |
| [security/session-management.md](security/session-management.md) | Multi-device session, expiry, dan pencabutan sesi (revocation). |

### 6. Pengujian, Performa & Development
| Dokumen | Deskripsi |
|---|---|
| [testing/testing-strategy.md](testing/testing-strategy.md) | Strategi pengujian komprehensif. |
| [testing/authentication-testing.md](testing/authentication-testing.md) | Cakupan pengujian unit dan integrasi modul autentikasi. |
| [testing/workspace-testing.md](testing/workspace-testing.md) | Cakupan pengujian unit dan integrasi modul workspace. |
| [testing/todo-testing.md](testing/todo-testing.md) | Cakupan dan hasil nyata pengujian Phase 3 (138 test Todo). |
| [testing/metadata-reminder-testing.md](testing/metadata-reminder-testing.md) | Cakupan pengujian Tag, Label, Reminder, dan cara menjalankannya. |
| [performance/todo-query-optimization.md](performance/todo-query-optimization.md) | Index, EXPLAIN ANALYZE, dan rekomendasi optimasi query Todo. |
| [performance/metadata-query-optimization.md](performance/metadata-query-optimization.md) | Index metadata, batch fetch, dan hasil EXPLAIN ANALYZE Phase 4. |
| [development/local-setup.md](development/local-setup.md) | Panduan setup lokal dan eksekusi development server. |
| [development/environment-configuration.md](development/environment-configuration.md) | Konfigurasi environment variables. |
| [development/docker-development.md](development/docker-development.md) | Panduan build dan container Docker. |
