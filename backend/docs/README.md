# Indeks Dokumentasi Backend TodoIt

Semua dokumen ditulis dalam Bahasa Indonesia. Dokumen di folder ini adalah **rencana teknis
Phase 0**, bukan dokumentasi hasil implementasi. Setiap keputusan yang berpotensi menimbulkan
konflik requirement dicatat beserta rekomendasinya.

## Cara Membaca

1. Mulai dari [`architecture/overview.md`](architecture/overview.md) untuk konteks sistem.
2. Lanjut ke [`architecture/modular-monolith.md`](architecture/modular-monolith.md) dan
   [`architecture/project-structure.md`](architecture/project-structure.md).
3. Pahami domain di [`architecture/domain-analysis.md`](architecture/domain-analysis.md).
4. Database: [`database/database-design.md`](database/database-design.md) →
   [`database/entity-relationship.md`](database/entity-relationship.md) →
   [`database/index-strategy.md`](database/index-strategy.md) →
   [`database/migrations.md`](database/migrations.md).
5. API: [`api/api-overview.md`](api/api-overview.md) →
   [`api/endpoint-planning.md`](api/endpoint-planning.md) →
   [`api/response-convention.md`](api/response-convention.md) →
   [`api/error-convention.md`](api/error-convention.md) →
   [`api/cursor-pagination.md`](api/cursor-pagination.md).
6. Keamanan & perilaku: authentication flow, workspace authorization, timezone, worker.
7. Operasional: docker development, testing strategy, docker production, environment strategy.
8. Eksekusi: [`implementation-roadmap.md`](implementation-roadmap.md).

## Daftar Dokumen

### Architecture

| Dokumen | Isi |
|---|---|
| [`architecture/overview.md`](architecture/overview.md) | Konteks sistem, aktor, prinsip arsitektur, alur request |
| [`architecture/modular-monolith.md`](architecture/modular-monolith.md) | Definisi modul, komunikasi, transaksi, worker, route registration |
| [`architecture/project-structure.md`](architecture/project-structure.md) | Struktur final folder/file dan alasannya |
| [`architecture/module-dependencies.md`](architecture/module-dependencies.md) | Dependency graph, port/adapter, aturan anti-circular |
| [`architecture/domain-analysis.md`](architecture/domain-analysis.md) | 15 domain: tujuan, fitur, entitas, endpoint, aturan |
| [`architecture/authentication-flow.md`](architecture/authentication-flow.md) | JWT, refresh rotation, session, rate limit |
| [`architecture/workspace-authorization.md`](architecture/workspace-authorization.md) | Role, permission matrix, alur otorisasi |
| [`architecture/timezone-handling.md`](architecture/timezone-handling.md) | Today/Upcoming/Overdue, DST, konversi UTC |
| [`architecture/notification-worker.md`](architecture/notification-worker.md) | Worker lifecycle, locking, idempotensi, SMTP |

### Database

| Dokumen | Isi |
|---|---|
| [`database/database-design.md`](database/database-design.md) | 12 tabel, kolom, constraint, cascade, workspace scope |
| [`database/entity-relationship.md`](database/entity-relationship.md) | ERD Mermaid dan penjelasan relasi |
| [`database/index-strategy.md`](database/index-strategy.md) | Index untuk list, cursor, worker, notifikasi |
| [`database/migrations.md`](database/migrations.md) | Urutan Goose, up/down, transaksi, rollout |

### API

| Dokumen | Isi |
|---|---|
| [`api/api-overview.md`](api/api-overview.md) | Base URL, versi, auth, content type, health, konvensi |
| [`api/endpoint-planning.md`](api/endpoint-planning.md) | Kontrak 47 endpoint per modul |
| [`api/response-convention.md`](api/response-convention.md) | Envelope, DTO, pagination, null policy |
| [`api/error-convention.md`](api/error-convention.md) | Format error, kode, status, validasi |
| [`api/cursor-pagination.md`](api/cursor-pagination.md) | Format cursor, signing, sorting, edge case |

### Development

| Dokumen | Isi |
|---|---|
| [`development/docker-development.md`](development/docker-development.md) | Compose dev, hot reload, volume, migration |
| [`development/testing-strategy.md`](development/testing-strategy.md) | Piramida test, fixture, test DB isolation |

### Deployment

| Dokumen | Isi |
|---|---|
| [`deployment/docker-production.md`](deployment/docker-production.md) | Multi-stage image, non-root, health, shutdown |
| [`deployment/environment-strategy.md`](deployment/environment-strategy.md) | Env matrix, secret manager, rotasi |

### Roadmap

| Dokumen | Isi |
|---|---|
| [`implementation-roadmap.md`](implementation-roadmap.md) | Phase 0–9, scope, acceptance criteria |

## Status Phase

| Phase | Status |
|---|---|
| 0 — Analysis & Technical Planning | Selesai (dokumen ini) |
| 1 — Foundation & Infrastructure | Belum dimulai |
| 2–9 | Belum dimulai |

## Konvensi Penulisan

- Istilah teknis dipertahankan dalam bahasa Inggris (workspace, cursor, token, worker).
- Setiap keputusan desain memakai pola **Keputusan → Alasan → Alternatif yang ditolak**.
- Diagram memakai Mermaid agar dapat dirender di GitHub/GitLab.
- Contoh JSON hanya ilustrasi kontrak, bukan output implementasi nyata.
