# Todo Backend

API dan background worker untuk aplikasi Todo. Keduanya adalah entry point terpisah dari satu modular monolith: autentikasi, workspace, todo, metadata, kolaborasi, dan notifikasi.

Dokumentasi rinci ada di [docs/README.md](docs/README.md).

## Fitur

- Health, readiness, dan OpenAPI Scalar.
- Registrasi, login, JWT, refresh token rotation, dan session.
- Workspace, anggota, undangan, dan kepemilikan.
- Todo, tag, label, reminder, cursor pagination.
- Notifikasi in-app dan email lewat antrean PostgreSQL.

## Stack

Bun 1.4.4, TypeScript strict, Elysia, Drizzle, PostgreSQL 17.5, Nodemailer, OpenAPI. Antrean job memakai PostgreSQL, bukan Redis.

## Struktur

`src/main.ts` menjalankan API. `src/worker.ts` menjalankan worker. Modul bisnis ada di `src/modules`. Konfigurasi hanya dibaca di `src/config`.

## Prasyarat dan instalasi

Bun 1.4 atau lebih baru, Docker untuk PostgreSQL development, dan salinan environment:

```bash
bun install
cp .env.development.example .env.development
cp .env.test.example .env.test
docker compose -f compose.yaml up -d postgres
bun --env-file=.env.development node_modules/drizzle-kit/bin.cjs migrate
```

## Menjalankan

```bash
bun run dev
bun run worker:dev
bun test --env-file=.env.test
bun run typecheck
```

API development: `http://127.0.0.1:4000`. OpenAPI: `/openapi` dan `/openapi/json`.

## Docker

Development, termasuk Mailpit: `bun run docker:dev`.

Production memakai image yang sama untuk API (`bun dist/main.js`) dan worker (`bun dist/worker.js`). Lihat [compose.production.yaml](compose.production.yaml). File itu tidak memublikasikan PostgreSQL. Deployment production belum dijalankan dari repository ini.

## Keamanan dan operasi

Secret production datang dari environment platform, bukan dari image. Rate limit bersama memakai tabel PostgreSQL. Backup dan restore ada di `infra/scripts` dan menolak target production tanpa konfirmasi eksplisit.

## Pengujian

`bun run verify` menjalankan typecheck, pemeriksaan boundary, OpenAPI, seluruh tes, dan build. Tes membutuhkan PostgreSQL `todo_test`. Coverage tidak diukur pada laporan terakhir kecuali perintah `bun run test:coverage` dijalankan.

Skrip beban k6 ada di `tests/load`. Angka throughput jaringan tidak dicantumkan bila k6 tidak dijalankan.
