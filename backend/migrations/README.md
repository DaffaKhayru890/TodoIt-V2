# Migrations

Folder ini berisi migration SQL Goose. **Phase 1 belum membuat migration domain**
(tidak ada tabel users/workspaces/tasks dan seterusnya). Yang disiapkan pada Phase 1
hanya struktur folder, konvensi, dan tooling.

## Tooling

- Goose: `github.com/pressly/goose/v3`
- Versi yang dipin di script: **v3.30.0**
- Format: SQL murni dengan `-- +goose Up` dan `-- +goose Down`
- Tracking: tabel `goose_db_version` (dibuat Goose)
- GORM `AutoMigrate` **tidak dipakai**

Instalasi CLI (opsional; script dapat memakai `go run` dengan versi yang dipin):

```bash
go install github.com/pressly/goose/v3/cmd/goose@v3.30.0
```

## Konvensi nama

```text
00001_create_users.sql
00002_create_user_sessions.sql
00003_create_workspaces.sql
```

- Nomor 5 digit, sequential.
- Nama deskriptif bahasa Inggris, snake_case.
- Satu file = satu unit perubahan yang dapat di-rollback.
- Jangan mengubah migration yang sudah dijalankan; buat migration baru.
- Setiap file wajib memiliki `Up` dan `Down`.

## Perintah

Dari folder `backend/`:

```bash
./scripts/migrate-status.sh
./scripts/migrate-up.sh
./scripts/migrate-up.sh --allow-missing   # diteruskan ke goose
./scripts/migrate-down.sh
./scripts/migrate-create.sh create_users
```

Script memuat `.env.development` secara default. Gunakan `ENV_FILE` untuk file lain:

```bash
ENV_FILE=.env.test ./scripts/migrate-status.sh
```

`DATABASE_URL` dapat diberikan langsung dan akan dipakai tanpa membentuk ulang dari
`DB_*`:

```bash
DATABASE_URL='postgres://root:dev%40123@localhost:5432/todolist?sslmode=disable' \
  ./scripts/migrate-up.sh
```

## Down di production

`migrate-down.sh` menolak berjalan saat `APP_ENV=production` kecuali
`ALLOW_MIGRATE_DOWN=true` diberikan secara eksplisit. Rollback aplikasi tidak otomatis
berarti rollback database (lihat `docs/database/migrations.md`).

## Phase berikutnya

Migration domain akan ditambahkan sesuai urutan dependency pada
`docs/database/migrations.md`. Phase 1 tidak membuat tabel apa pun.
