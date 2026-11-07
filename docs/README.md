# Dokumentasi Todo Backend

Dokumentasi ini menjelaskan backend aplikasi Todo List yang dibangun dengan arsitektur Clean Architecture dan Modular Monolith:
- **Phase 1**: Project setup, Clean Architecture, konfigurasi environment, koneksi PostgreSQL lewat Drizzle, OpenAPI Scalar, health endpoint, infrastruktur testing, dan Docker.
- **Phase 2**: Authentication Module (Register, Login, JWT, Refresh Token Rotation, Session Management, Logout, Me) dan Workspace Module (Ownership, Membership, Role-based Authorization Policy, Soft Archive).

Status implementasi: **Phase 2 selesai**.

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

### 3. API & OpenAPI
| Dokumen | Deskripsi |
|---|---|
| [api/openapi.md](api/openapi.md) | Konvensi integrasi OpenAPI Scalar. |
| [api/authentication-api.md](api/authentication-api.md) | Dokumentasi endpoint autentikasi (/api/v1/auth). |
| [api/workspace-api.md](api/workspace-api.md) | Dokumentasi endpoint workspace (/api/v1/workspaces). |

### 4. Keamanan
| Dokumen | Deskripsi |
|---|---|
| [security/password-security.md](security/password-security.md) | Argon2id hashing, timing equalization, dan password policy. |
| [security/jwt-security.md](security/jwt-security.md) | JWT access token, HS256, klaim minimal, dan secret validation. |
| [security/refresh-token-security.md](security/refresh-token-security.md) | 256-bit opaque token, SHA-256 hash storage, cookie security, dan CORS. |
| [security/session-management.md](security/session-management.md) | Multi-device session, expiry, dan pencabutan sesi (revocation). |

### 5. Pengujian & Development
| Dokumen | Deskripsi |
|---|---|
| [testing/testing-strategy.md](testing/testing-strategy.md) | Strategi pengujian komprehensif. |
| [testing/authentication-testing.md](testing/authentication-testing.md) | Cakupan pengujian unit dan integrasi modul autentikasi. |
| [testing/workspace-testing.md](testing/workspace-testing.md) | Cakupan pengujian unit dan integrasi modul workspace. |
| [development/local-setup.md](development/local-setup.md) | Panduan setup lokal dan eksekusi development server. |
| [development/environment-configuration.md](development/environment-configuration.md) | Konfigurasi environment variables. |
| [development/docker-development.md](development/docker-development.md) | Panduan build dan container Docker. |
