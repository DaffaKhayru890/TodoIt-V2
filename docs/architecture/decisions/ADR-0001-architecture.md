# ADR-0001 — Arsitektur dan Teknologi Fondasi

- **Status:** Diterima (Phase 1)
- **Tanggal:** 2026-11-06
- **Lingkup:** Fondasi backend Todo List (project setup, arsitektur, infrastruktur, testing, dokumentasi)

## Konteks

Aplikasi Todo List backend akan dibangun bertahap. Phase 1 hanya fondasi: kerangka proyek,
lapisan arsitektur, koneksi database, konfigurasi environment, OpenAPI, health endpoint,
infrastruktur test, dan Docker. Phase berikutnya menambahkan modul bisnis
(User/Workspace, Todo, Tag, Label, Reminder, Notification) di atas fondasi yang sama.

Kebutuhan yang harus dipenuhi keputusan ini:

1. Business logic tidak boleh terkunci pada framework/ORM/driver sehingga mudah diuji dan diganti.
2. Struktur harus memungkinkan banyak business module dalam satu codebase tanpa saling mengotori.
3. Konfigurasi harus valid sebelum aplikasi berjalan, dan tidak boleh menyebarkan `process.env`.
4. Pengembangan lokal harus reproducible (satu perintah untuk database + aplikasi).
5. Perubahan skema harus tertelusur, bukan lewat perintah manual di database.

## Keputusan

### 1. Runtime dan bahasa: Bun + TypeScript strict

- **Bun** sebagai runtime sekaligus package manager; `bun.lock` menjadi lockfile. npm/yarn/pnpm
  tidak dipakai. Bun punya environment loader bawaan sehingga `dotenv` tidak diperlukan.
- **TypeScript** dengan `strict` beserta `noUncheckedIndexedAccess` dan
  `exactOptionalPropertyTypes`. Konsekuensinya seluruh akses indeks dan properti opsional harus
  ditangani eksplisit — ini yang membuat pemetaan error dan konfigurasi benar-benar tervalidasi.
- Versi dependency stabil dan saling kompatibel: `elysia@1.4.31`, `@elysia/openapi@1.4.17`,
  `@elysiajs/cors@1.4.3`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`, `pg@8.23.1`,
  `typescript@5.9.3` (`typescript@7` tersedia sebagai `latest` tetapi belum dipakai),
  `@types/bun@1.4.4`. Tidak ada paket alpha/beta/RC.

Alternatif yang dipertimbangkan: Node.js + Express/Fastify (runtime lebih berat, loader env perlu
pustaka tambahan), Deno (ekosistem Elysia/Drizzle kurang cocok). Bun dipilih karena
kecepatan install/start dan kemampuan `bun test` bawaan.

### 2. Arsitektur: Clean Architecture di dalam Modular Monolith

Satu codebase, satu deployment unit, dengan empat layer per module:
`domain → application → infrastructure → presentation` dan arah dependency ke dalam.
Contract (interface) dimiliki layer dalam, implementasinya di `infrastructure`, dan keduanya
dipertemukan di composition root `src/bootstrap/container.ts`.

**Konsekuensi yang diterima:** lebih banyak file dan satu lapis abstraksi tambahan dibanding
aplikasi "route langsung query". Trade-off ini diambil demi testability dan umur panjang
business rule. Aturan detailnya di [dependency-rules.md](../dependency-rules.md).

Modul pertama (health) sengaja **tidak** memiliki folder `domain`. Hanya layer yang benar-benar
dipakai yang dibuat, agar tidak ada file kosong atau placeholder business logic.

### 3. Web framework: Elysia + TypeBox sebagai satu sumber schema

Schema TypeBox dipakai untuk validasi request, dokumentasi OpenAPI, dan bentuk response sekaligus,
sehingga dokumentasi tidak dapat menyimpang dari perilaku. Prefix API bisnis `/api/v1`
(konvensi dicatat di `src/bootstrap/register-modules.ts`), sementara endpoint probe berada di root
karena dipakai health check orchestrator.

### 4. Dokumentasi API: `@elysia/openapi` dengan Scalar

Endpoint `/openapi` (UI interaktif) dan `/openapi/json` (spesifikasi OpenAPI 3.1.2).
**Catatan implementasi:** spesifikasi awal menyebut `@elysia/openapi`; paket `@elysiajs/openapi`
adalah nama yang sama pada scope lama. Keduanya tersedia di registry dengan versi identik
(1.4.17), dan proyek ini memakai `@elysia/openapi` agar sesuai spesifikasi.

### 5. Persistensi: PostgreSQL + Drizzle ORM (driver `pg`)

Drizzle hanya boleh dipakai di `src/shared/infrastructure/database` dan
`src/modules/*/infrastructure`. Connection pool dibuat sekali di composition root
(`max: 10`, `idleTimeoutMillis: 30s`, `connectionTimeoutMillis: 5s`), ditutup saat shutdown.
Perubahan skema **selalu** lewat migration (`bun db:generate` → `bun db:migrate`).

Phase 1 tidak mendefinisikan tabel apa pun: `src/shared/infrastructure/database/schema/index.ts`
mengekspor `schema = {}` dengan satu komentar penjelas. Karena tidak ada perubahan skema,
`bun db:generate` menghasilkan folder `drizzle/` (berisi `meta/_journal.json`) tanpa file SQL,
dan `bun db:migrate` tetap dapat dijalankan untuk menyiapkan tabel `_drizzle_migrations` di
database target.

### 6. Konfigurasi: satu modul validasi, satu aturan per variabel

`src/config/env-schema.ts` mendeklarasikan aturan parsing, `src/config/env.ts` memuat
`ENV_RULES` dan mengumpulkan **seluruh** masalah dalam `EnvironmentConfigurationError`, lalu
`src/config/app-config.ts` menghasilkan objek `AppConfig` bertipe. Aplikasi berhenti sebelum
listen bila konfigurasi kritis tidak valid. Hanya `src/config/env.ts` yang menyentuh
`process.env`.

Environment: `development`, `test`, `staging`, `production` dengan file `.env.<name>` terpisah
dan contoh `.env.<name>.example`. Database development memakai user `root` dengan password
`dev@123` dan database `todo_development`; test memakai `todo_test` hasil init script container.
Kredensial ini **hanya** untuk lokal — contoh staging/production memakai
`__SET_VIA_SECRET_MANAGER__` agar tidak ada rahasia production di repository atau image layer.

### 7. Testing: `bun:test`, dua lapis

Unit test merakit aplikasi in-process lewat `createApp()` + `app.handle(Request)` dengan stub
port, tanpa membuka port. Integration test memakai PostgreSQL nyata dan menjalankan siklus proses
sebenarnya (`Bun.spawn` + `SIGTERM`) untuk memverifikasi startup dan graceful shutdown.
Test wajib ada sejak phase pertama, tidak ditunda.

### 8. Container: Docker multi-stage + Docker Compose

Lima stage: `base`, `dependencies`, `development`, `build`, `production`. Production memakai
hanya dependency runtime, hasil `bun build`, non-root user (`bun`), tanpa `.env`, plus
HEALTHCHECK. Compose menjalankan service `postgres` (versi dipin `17.5-alpine`, healthcheck
`pg_isready`, volume persisten `todo-postgres-data`, port di-bind hanya ke `127.0.0.1`) dan
service `backend` yang menunggu database sehat.

## Konsekuensi

- Menambah endpoint berarti menyentuh 3–4 layer + composition root; lebih lambat untuk fitur kecil,
  lebih aman untuk fitur yang bertahan lama.
- Tidak ada ORM-level "auto schema push": setiap perubahan skema butuh migration dan review.
- Image production tetap ~360 MB (base `oven/bun:1.4.4-slim`); pemangkasan lebih lanjut
  (mis. `--compile` menjadi single binary) belum dilakukan karena belum dibutuhkan.
- TypeBox menjadi sumber kebenaran schema; mengganti framework HTTP berarti menulis ulang lapisan
  presentation, bukan lapisan domain/application.
- Belum ada rule lint yang menegakkan arah impor secara otomatis. Penegakan saat ini lewat
  review dan perintah `grep` pada [dependency-rules.md](../dependency-rules.md).

## Keputusan yang ditunda ke phase berikutnya

- Definisi entity, value object, dan repository contract modul bisnis.
- Skema dan migration untuk Workspace, Todo, Tag, Label, Reminder, Notification.
- Autentikasi/authorisasi, domain event, dan caching.
- Enforced architecture lint (dependency-cruiser/eslint boundary) dan CI pipeline.
