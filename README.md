# Todo Backend

Backend aplikasi Todo List. Repository ini sedang berada pada **Phase 1**: fondasi proyek, Clean Architecture + modular monolith, konfigurasi environment, koneksi PostgreSQL/Drizzle, OpenAPI, health endpoint, infrastruktur testing, dan Docker.

Endpoint yang tersedia saat ini hanya `GET /health`, `GET /ready`, `GET /openapi`, dan `GET /openapi/json`. Endpoint bisnis (User, Workspace, Todo, Tag, Label, Reminder, Notification) **belum diimplementasikan** dan akan dibangun pada phase berikutnya di atas fondasi ini.

## Technology stack

| Komponen | Versi terpasang | Catatan |
| --- | --- | --- |
| Bun | 1.4.4 | runtime, package manager, dan test runner. Tidak memakai npm/yarn/pnpm; lockfile `bun.lock` |
| TypeScript | 5.9.3 | strict mode penuh (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, dll.) |
| Elysia | 1.4.31 | HTTP framework |
| @elysia/openapi | 1.4.17 | OpenAPI + UI Scalar (nama paket sesuai spesifikasi Phase 1) |
| @elysiajs/cors | 1.4.3 | kebijakan CORS dari environment |
| Drizzle ORM | 0.45.4 | hanya dipakai di infrastructure layer |
| pg | 8.23.1 | driver PostgreSQL (node-postgres) |
| drizzle-kit | 0.31.11 | generate & apply migration |
| PostgreSQL | 17.5-alpine | versi dipin, via container `postgres` |

Tanpa `node` di PATH: skrip memanggil Bun secara eksplisit, termasuk `bun node_modules/drizzle-kit/bin.cjs` untuk perintah `db:*`.

## Quick start

```bash
# 1. pasang dependency
bun install

# 2. siapkan file environment (sekali saja)
cp .env.development.example .env.development
cp .env.test.example .env.test

# 3. jalankan PostgreSQL (butuh akses Docker)
sg docker -c "docker compose up -d postgres"

# 4. jalankan aplikasi
bun run dev
```

Verifikasi:

```bash
curl -i http://127.0.0.1:4000/health    # 200 {"status":"ok"} + header x-request-id
curl -s http://127.0.0.1:4000/ready     # {"status":"ready","dependencies":{"database":"connected"}}
curl -s http://127.0.0.1:4000/openapi | head -c 120   # HTML UI Scalar (buka di browser)
curl -s http://127.0.0.1:4000/openapi/json | head -c 200
```

Alternatif seluruhnya di container (aplikasi + database + hot reload):

```bash
bun run docker:dev
```

Langkah detail, termasuk troubleshooting, ada di [docs/development/local-setup.md](docs/development/local-setup.md).

## Struktur project

```text
src/
├── main.ts                      startup, graceful shutdown, fail-fast konfigurasi
├── bootstrap/                   composition root: container, create-app, register-modules
├── config/                      env-schema, env (satu-satunya pembaca process.env), app-config
├── modules/
│   └── health/
│       ├── application/         use case CheckServiceReadiness + port DatabaseProbe
│       ├── infrastructure/      adapter probe ke database client
│       └── presentation/http/   route /health dan /ready + metadata OpenAPI
└── shared/
    ├── infrastructure/          database client (pool), schema Drizzle, logger JSON
    └── presentation/http/       plugin openapi & cors, sampul error, request-id

drizzle/                         file migration (Phase 1: belum ada tabel)
infra/postgres/init/             skrip inisialisasi database lokal
tests/{unit,integration,helpers}
docs/                            dokumentasi Bahasa Indonesia
Dockerfile · compose.yaml · drizzle.config.ts · tsconfig.json
```

Arah dependency dijaga: `presentation → application → domain`, dan infrastructure mengimplementasikan port layer dalam. Domain tidak mengenal Elysia maupun Drizzle.

## Scripts

| Perintah | Fungsi |
| --- | --- |
| `bun run dev` | server development dengan `--watch`, memuat `.env.development` |
| `bun run start` | alias `start:production` |
| `bun run start:staging` | production build path dengan `.env.staging` |
| `bun run start:production` | jalan tanpa `--env-file`; konfigurasi dari environment deploy |
| `bun run test` | seluruh test (`--env-file=.env.test`) |
| `bun run test:watch` / `test:coverage` | mode watch / ringkasan cakupan |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:generate` / `db:migrate` / `db:migrate:test` / `db:studio` | workflow migration Drizzle |
| `bun run docker:dev` / `docker:down` | up/down stack development |

## Environment

Empat environment didukung: `development`, `test`, `staging`, `production`. Setiap `.env.<name>` bersifat self-contained dan divalidasi saat startup — variabel wajib yang hilang membuat proses keluar dengan daftar masalah lengkap, sebelum listener dibuka.

Seluruh file `.env*` dikecualikan dari version control; hanya `.env.*.example` yang ikut di-commit. Kredensial development (`root` / `dev@123`) milik container lokal saja dan tidak pernah dipakai di staging/production, yang mengambil kredensial dari deployment environment atau secret manager dengan `DATABASE_SSL=true`.

Daftar variabel, tipe, default, dan perbedaan antar environment: [docs/development/environment-configuration.md](docs/development/environment-configuration.md).

## Status Phase 1

- Type checking bersih (`bun run typecheck`, tanpa output).
- 51 test lulus, 0 gagal (unit + integration terhadap PostgreSQL nyata).
- Stack development berjalan di Docker; `/health`, `/ready`, `/openapi`, `/openapi/json` terverifikasi.
- Image production multi-stage terverifikasi: non-root, tanpa `.env`, ada healthcheck, dan `docker stop` menghasilkan graceful shutdown (exit 0).
- Migration berjalan; `bun run db:generate` melaporkan `0 tables`, sesuai desain Phase 1 yang belum mendefinisikan tabel bisnis.
- Dokumentasi Phase 1 lengkap di folder `docs/`.

## Dokumentasi

Mulai dari [docs/README.md](docs/README.md) — di sana ada urutan baca arsitektur, development, database, API, dan testing, beserta aturan pemeliharaan dokumen.
