# Menjalankan Proyek di Mesin Lokal

## Prasyarat

| Tool | Versi minimum | Dipakai untuk |
|------|---------------|---------------|
| Bun | 1.4.x (proyek diverifikasi pada 1.4.4) | runtime, package manager, test runner |
| Docker Engine + Docker Compose plugin | Docker 24+ / Compose v2 | PostgreSQL lokal dan container aplikasi |
| Git | bebas | version control |

Tidak perlu Node.js: Bun menjalankan TypeScript secara langsung, dan seluruh script
`package.json` memanggil `bun` (termasuk `tsc` dan `drizzle-kit` yang dijalankan lewat Bun).

## 1. Instalasi Bun

```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL -l          # atau buka terminal baru
bun --version
```

Bun memasang binary di `~/.bun/bin`. Pastikan direktori itu ada di `PATH`; bila tidak,
perintah di bawah ini mengasumsikan `bun` sudah dapat dipanggil langsung.

## 2. Instalasi Docker

```bash
# Distribusi berbasis Debian/Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout lalu login lagi agar grup aktif
docker --version
docker compose version
```

Tanpa keanggotaan grup `docker`, setiap perintah Docker akan gagal
`permission denied while trying to connect to the docker API`. Alternatif cepat tanpa logout:
`sg docker -c "docker compose up"` (lihat Troubleshooting).

## 3. Menyiapkan dependency proyek

```bash
cd /path/to/TodoIt-v2
bun install            # memakai bun.lock, tidak menghasilkan node_modules ganda
```

## 4. Menyiapkan file environment

```bash
cp .env.development.example .env.development
cp .env.test.example .env.test
# staging/production hanya dibuat saat akan dipakai
cp .env.staging.example .env.staging
cp .env.production.example .env.production
```

`.env.development` dan `.env.test` versi contoh sudah berisi nilai yang cocok dengan
PostgreSQL dari `compose.yaml` (user `root`, password `dev@123`, port `5432`).
File `.env*` asli tidak di-commit; hanya berekor `.example` yang masuk repository.
Jangan pernah memakai kredensial development di staging/production — keduanya memakai
placeholder yang diisi dari secret manager.

## 5. Menjalankan PostgreSQL

```bash
docker compose up -d postgres
docker compose ps                 # status postgres harus "healthy"
```

Yang terjadi:

- image `postgres:17.5-alpine` (versi dipin, bukan `latest`),
- volume persisten `todo-postgres-data` di `/var/lib/postgresql/data`,
- port hanya di-bind ke `127.0.0.1:5432` sehingga tidak terekspos ke jaringan host,
- healthcheck `pg_isready` setiap 5 detik,
- `infra/postgres/init/00-create-test-database.sql` membuat database `todo_test`
  (hanya berjalan saat volume masih kosong).

## 6. Menjalankan aplikasi

Dua opsi, pilih salah satu:

**A. Process lokal (paling umum saat develop)**

```bash
bun run dev        # watch mode, membaca .env.development
```

**B. Semua di Docker (hot reload lewat bind mount)**

```bash
bun run docker:dev        # = docker compose up --build
bun run docker:down       # = docker compose down
```

Verifikasi:

```bash
curl -i http://localhost:4000/health     # 200, {"status":"ok"}
curl -i http://localhost:4000/ready      # 200, {"status":"ready","dependencies":{"database":"connected"}}
open http://localhost:4000/openapi       # UI dokumentasi Scalar
curl -s http://localhost:4000/openapi/json | head -40
```

Bila database belum siap, `/ready` menjawab **503** dengan sampul error
`SERVICE_UNAVAILABLE` — ini perilaku yang diharapkan, bukan kegagalan startup.

## 7. Menjalankan test

```bash
bun run test              # seluruh test (unit + integration), memakai .env.test
bun run test:watch        # ulang otomatis saat file berubah
bun run test:coverage     # laporan coverage
bun test tests/unit       # hanya unit test (tidak butuh PostgreSQL)
```

Integration test menghubungi PostgreSQL nyata dari database `todo_test`, jadi container
`postgres` harus berjalan lebih dulu.

## 8. Migration database

```bash
bun run db:generate       # membaca src/shared/infrastructure/database/schema, menulis drizzle/
bun run db:migrate        # menerapkan migration ke todo_development
bun run db:migrate:test   # menerapkan ke todo_test
bun run db:studio         # Drizzle Studio (GUI) untuk inspeksi
```

Pada Phase 1 belum ada tabel bisnis, sehingga `db:generate` mencetak `0 tables` dan
"nothing to migrate" — itu normal. Alur lengkap migration ada di
[../database/database-setup.md](../database/database-setup.md).

## 9. Type checking

```bash
bun run typecheck         # tsc --noEmit, tidak menghasilkan file
```

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|--------|---------------|--------|
| `permission denied ... /var/run/docker.sock` | user belum aktif di grup `docker` | logout-login ulang, atau `sg docker -c "docker compose up -d postgres"` |
| `EADDRINUSE :::5432` | ada PostgreSQL lain di host | ubah binding port di `compose.yaml` menjadi mis. `127.0.0.1:5433:5432` dan sesuaikan `DATABASE_PORT` |
| `Aplikasi tidak dapat dimulai.` + daftar variabel | file `.env.<environment>` belum ada / variabel wajib kosong | salin dari `.example`, cek `NODE_ENV` dan nama file |
| `/ready` selalu 503 saat `/health` 200 | database mati, salah kredensial, atau `DATABASE_HOST` tidak dapat dicapai | `docker compose ps`, cek `DATABASE_*` di file environment aktif |
| `/ready` 503 saat menjalankan test | container `postgres` belum `healthy` atau `todo_test` belum ada | tunggu healthcheck; hapus volume (`docker compose down -v`) agar init script jalan lagi |
| `ECONNREFUSED 127.0.0.1:5432` dari dalam container | `DATABASE_HOST` masih `127.0.0.1` di dalam network compose | service `backend` sudah menimpa ke `postgres`; bila Anda menambah service sendiri, set `DATABASE_HOST=postgres` |
| `database "todo_test" does not exist` | volume dibuat sebelum init script ada | `docker compose down -v && docker compose up -d postgres` |
| `bun: command not found` | `~/.bun/bin` tidak masuk `PATH` | tambahkan `export PATH="$HOME/.bun/bin:$PATH"` ke shell rc |
| `error TS2307` saat `bun run typecheck` | dependency belum dipasang | `bun install` |
| Migration tidak terbaca saat `db:migrate` | database target belum pernah dimigrasi | jalankan `bun db:migrate` (bukan `generate`) untuk menciptakan tabel `_drizzle_migrations` |
