# Pengembangan dengan Docker

Dokumen ini menjelaskan isi [Dockerfile](file:///home/daffakhayru/Applications/TodoIt-v2/Dockerfile) dan [compose.yaml](file:///home/daffakhayru/Applications/TodoIt-v2/compose.yaml), cara menjalankan environment development, dan bagaimana image production dirakit. Semua perintah di bawah sudah dijalankan dan diverifikasi pada machine development.

## 1. Dockerfile multi-stage

Lima stage, semuanya berbasis `oven/bun:1.4.4-slim` (versi dipin, tidak ada tag `latest`):

| Stage | Isi | Dipakai oleh |
| --- | --- | --- |
| `base` | image Bun + `WORKDIR /app` + salin `package.json` dan `bun.lock` | fondasi stage lain |
| `dependencies` | `bun install --frozen-lockfile` (termasuk devDependencies) | `development`, `build` |
| `development` | salin seluruh source, `NODE_ENV=development`, `CMD ["bun","run","dev"]` | container dev dengan hot reload |
| `build` | `bun run typecheck` lalu `bun build src/main.ts --outdir=dist --target=bun` | menghasilkan `dist/` untuk production |
| `production` | install runtime-only, salin `dist`, `USER bun`, `HEALTHCHECK`, `CMD ["bun","run","dist/main.js"]` | image rilis |

Pilihan yang perlu dicatat:

- **Urusal layer dependency.** `package.json` + `bun.lock` disalin lebih dulu, baru `bun install --frozen-lockfile`, lalu source. Perubahan kode tidak membuat ulang layer install.
- **Typecheck sebagai bagian build.** Stage `build` gagal bila `tsc --noEmit` error, sehingga image production tidak mungkin berisi kode yang tidak lolos type checking.
- **`--target=bun`.** Bundle hasil `bun build` tetap memakai runtime Bun (bukan Node), sehingga API seperti `Bun.serve` di balik Elysia berjalan normal.
- **Production ringan.** `bun install --frozen-lockfile --production` hanya memasang dependency runtime (37 paket); devDependencies seperti `typescript` dan `drizzle-kit` tidak ikut. Hasil build terukur sekitar 362 MB dan isi `/app` hanya `bun.lock dist node_modules package.json` — **tidak ada `.env`, source, test, maupun docs**.
- **Non-root.** Stage `production` memakai `USER bun` (uid 1000) yang sudah tersedia di image Bun; file `dist` diberi kepemilikan `--chown=bun:bun`.
- **HEALTHCHECK tanpa shell.** Memakai exec form `bun -e` yang memanggil `/health`, karena image slim tidak menjamin ada `curl`/`wget` dan exec form menghindari shell:

```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "const r=await fetch(`http://127.0.0.1:${process.env.APP_PORT ?? 4000}/health`);process.exit(r.ok?0:1)"]
```

- **Rahasia tidak masuk image.** [.dockerignore](file:///home/daffakhayru/Applications/TodoIt-v2/.dockerignore) membuang `.env` dan `.env.*` (hanya `.env.*.example` diizinkan lewatkan agar contoh tetap ada di konteks build), `docs/`, `tests/`, `*.md`, `node_modules/`, `dist/`, `coverage/`, serta `Dockerfile`/`compose.yaml`/`.dockerignore` sendiri. Stage `production` juga tidak menjalankan `COPY . .` sama sekali — yang disalin hanya `package.json`, `bun.lock`, dan `dist` hasil build — sehingga file environment asli tidak mungkin masuk ke layer image. Konfigurasi production disuntik lewat environment platform deploy saat container jalan.

## 2. Compose development

Dua service.

### `postgres`

| Aspek | Nilai | Alasan |
| --- | --- | --- |
| image | `docker.io/library/postgres:17.5-alpine` | versi dipin |
| kredensial | `root` / `dev@123` / `todo_development` | khusus database lokal, dilarang dipakai di staging/production |
| port | `127.0.0.1:5432:5432` | binding hanya ke localhost, tidak terekspos ke jaringan host |
| volume | `postgres-data` (nama global `todo-postgres-data`) → `/var/lib/postgresql/data` | data tetap ada setelah container dihapus |
| init mount | `./infra/postgres/init` → `/docker-entrypoint-initdb.d:ro` | membuat `todo_test` saat volume pertama kali diinisialisasi |
| healthcheck | `pg_isready -U root -d todo_development`, `interval: 5s`, `retries: 12`, `start_period: 10s` | backend hanya boleh jalan setelah database benar-benar siap |

`infra/postgres/init/00-create-test-database.sql` berisi `CREATE DATABASE todo_test OWNER root;`. Skrip init hanya dijalankan saat direktori data masih kosong, sehingga volume yang sudah ada perlu dihapus bila skripnya berubah.

### `backend`

- `build.target: development`, `command: ["bun","run","dev"]` → hot reload `bun --watch`.
- `depends_on.postgres.condition: service_healthy` → startup menunggu healthcheck `pg_isready` lulus.
- `env_file: .env.development` plus override `DATABASE_HOST: postgres` dan `DATABASE_PORT: "5432"`. Override ini menang atas nilai di file (Bun memberi prioritas ke environment proses), jadi container terhubung lewat service name sementara host tetap bisa memakai `127.0.0.1:5432`.
- Bind mount `./:/app` agar edit kode langsung terlihat di container, ditambah anonymous volume `/app/node_modules` agar `node_modules` hasil build dalam image tidak tertimpa folder host.
- Port `127.0.0.1:4000:4000` dan healthcheck `/health`.

## 3. Perintah

```bash
# jalankan stack development (build + up)
bun run docker:dev
# atau
sg docker -c "docker compose up --build -d"

# hanya database (untuk bun run dev / bun run test di host)
sg docker -c "docker compose up -d postgres"

# lihat log dan status
sg docker -c "docker compose ps"
sg docker -c "docker compose logs -f backend"

# hentikan; volume data tetap tersimpan
bun run docker:down
# atau hapus sekalian volumenya (HANYA bila data development boleh hilang)
sg docker -c "docker compose down -v"

# build image production
sg docker -c "docker build --target production -t todo-backend:prod ."

# jalankan image production di network compose (butuh postgres hidup)
sg docker -c "docker run -d --name todo-prod --network todoit-v2_default \
  -e NODE_ENV=production -e APP_NAME='Todo Backend' -e APP_VERSION=0.1.0 \
  -e DATABASE_HOST=postgres -e DATABASE_PORT=5432 -e DATABASE_USER=root \
  -e DATABASE_PASSWORD=dev@123 -e DATABASE_NAME=todo_development -e DATABASE_SSL=false \
  -e LOG_LEVEL=info -p 127.0.0.1:4100:4000 todo-backend:prod"

sg docker -c "docker stop todo-prod"   # amati graceful shutdown di log
sg docker -c "docker rm todo-prod"
```

Catatan environment: di shell ini akses socket Docker (`/var/run/docker.sock`) hanya jalan lewat grup `docker`. Bila perintah Docker menolak dengan `permission denied ... /var/run/docker.sock`, jalankan lewat `sg docker -c "..."` atau buka shell baru setelah keanggotaan grup aktif.

## 4. Verifikasi yang sudah dilakukan

Development stack (`docker compose up`):

- `GET /health` → 200 `{"status":"ok"}`, ada header `x-request-id` dan header CORS.
- `GET /ready` → 200 `{"status":"ready","dependencies":{"database":"connected"}}`.
- `GET /openapi` → 200 HTML UI Scalar.
- `GET /openapi/json` → OpenAPI 3.1.2, title `Todo Backend`, version `0.1.0`, dua server, tag `Health` dan `Documentation`, path `/health` dan `/ready`.

Image production:

- build lulus typecheck dan menghasilkan bundle;
- berjalan sebagai `uid=1000(bun)`;
- `/health` 200, `/ready` 200, route tak dikenal 404 dengan sampul error standar;
- `docker stop` memunculkan log `shutdown started` → `shutdown complete` dengan exit code `0` (proses menghentikan listener lebih dulu, lalu menutup pool database).

## 5. Keterbatasan yang disengaja

- `compose.yaml` hanya mengatur environment development. Deployment staging/production memakai platform sendiri (image yang sama, konfigurasi dari secret manager) sehingga tidak ada rahasia di repo.
- Tidak ada stage `runner` terpisah; `production` sudah berisi runtime dan healthcheck sehingga cukup dijalankan apa adanya.
- Image dev dan prod memakai basis yang sama (`oven/bun:1.4.4-slim`) agar perilaku runtime identik antara development dan rilis.
