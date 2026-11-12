# Database — Migration Planning

## 1. Tooling

| Aspek | Keputusan |
|---|---|
| Tool | Goose (`github.com/pressly/goose/v3`) |
| Format | SQL murni (`-- +goose Up`, `-- +goose Down`) |
| Lokasi | `backend/migrations/` |
| Penomoran | 5 digit, sequential (`00001`…) |
| Tracking | Tabel `goose_db_version` (dibuat Goose) |
| Dijalankan oleh | CLI `goose` di container migrasi / step deploy, **bukan** aplikasi |
| AutoMigrate GORM | **Dilarang** |

Alasan memilih Goose: SQL eksplisit, mudah direview, mendukung transaksi per migration,
tidak menyembunyikan DDL, dan dapat dijalankan sebagai job terpisah di production.

## 2. Konvensi File

```text
migrations/
├── 00001_create_users.sql
├── 00002_create_user_sessions.sql
├── 00003_create_workspaces.sql
├── 00004_create_workspace_members.sql
├── 00005_create_workspace_invitations.sql
├── 00006_create_tasks.sql
├── 00007_create_tags.sql
├── 00008_create_labels.sql
├── 00009_create_task_tags.sql
├── 00010_create_task_labels.sql
├── 00011_create_reminders.sql
├── 00012_create_notifications.sql
└── 00013_indexes_and_hardening.sql
```

Aturan:

- Satu file = satu unit perubahan yang dapat di-rollback.
- Nama file deskriptif, bahasa Inggris, snake_case.
- Tidak mengubah file yang sudah pernah dijalankan di environment mana pun. Perbaikan =
  migration baru.
- Tidak menaruh seed data production di migration. Seed development ada di `scripts/seed.sh`.
- Data referensi kecil (mis. tidak ada pada Phase 0) boleh di migration jika mutlak.
- Setiap migration **wajib** memiliki `Down` yang benar-benar mengembalikan schema.
- Tidak ada `CREATE EXTENSION` kecuali disepakati (Phase 0 tidak memerlukan extension).

## 3. Urutan Migration dan Dependency

```mermaid
flowchart TD
    U[00001 users] --> S[00002 user_sessions]
    U --> W[00003 workspaces]
    W --> M[00004 workspace_members]
    U --> M
    W --> I[00005 workspace_invitations]
    U --> I
    W --> T[00006 tasks]
    U --> T
    W --> TG[00007 tags]
    W --> LB[00008 labels]
    T --> TT[00009 task_tags]
    TG --> TT
    T --> TL[00010 task_labels]
    LB --> TL
    T --> R[00011 reminders]
    W --> R
    U --> R
    U --> N[00012 notifications]
    W --> N
    T --> N
    U --> X[00013 indexes]
    S --> X
    W --> X
    M --> X
    I --> X
    T --> X
    TG --> X
    LB --> X
    TT --> X
    TL --> X
    R --> X
    N --> X
```

| No | File | Membuat | Bergantung pada | Alasan urutan |
|---|---|---|---|---|
| 00001 | `create_users` | `users` | — | Akar identitas |
| 00002 | `create_user_sessions` | `user_sessions` | `users` | FK user |
| 00003 | `create_workspaces` | `workspaces` | `users` (owner) | Owner harus ada |
| 00004 | `create_workspace_members` | `workspace_members` | `workspaces`, `users` | Membership |
| 00005 | `create_workspace_invitations` | `workspace_invitations` | `workspaces`, `users` | Undangan |
| 00006 | `create_tasks` | `tasks` | `workspaces`, `users` | Task |
| 00007 | `create_tags` | `tags` | `workspaces` | Tag scoped workspace |
| 00008 | `create_labels` | `labels` | `workspaces` | Label scoped workspace |
| 00009 | `create_task_tags` | `task_tags` | `tasks`, `tags` | Composite FK butuh unique `(id, workspace_id)` dari kedua tabel |
| 00010 | `create_task_labels` | `task_labels` | `tasks`, `labels` | Idem |
| 00011 | `create_reminders` | `reminders` | `tasks`, `workspaces`, `users` | Reminder |
| 00012 | `create_notifications` | `notifications` | `users`, `workspaces`, `tasks` | Notifikasi |
| 00013 | `indexes_and_hardening` | Index tambahan, constraint opsional | Semua | Memisahkan index dari DDL tabel agar mudah diaudit |

### Mengapa `task_tags` Harus Setelah `tasks` dan `tags`

Composite FK membutuhkan:

- `tasks(id, workspace_id)` unique.
- `tags(id, workspace_id)` unique.

Keduanya dibuat di migration 00006 dan 00007. Jika `task_tags` dibuat lebih awal, FK gagal.

### Mengapa `reminders` Mencakup `workspaces` dan `users`

- `workspace_id` untuk composite FK ke task dan untuk query worker.
- `user_id` untuk penerima; FK ke `users`.

## 4. Struktur Migration Up/Down

Contoh ilustratif (bukan file aktual):

```sql
-- +goose Up
CREATE TABLE users (
    id uuid PRIMARY KEY,
    name varchar(100) NOT NULL,
    email varchar(254) NOT NULL,
    password_hash varchar(100) NOT NULL,
    timezone varchar(64) NOT NULL DEFAULT 'UTC',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT ck_users_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
    CONSTRAINT ck_users_email_lower CHECK (email = lower(email))
);

-- +goose Down
DROP TABLE IF EXISTS users;
```

Aturan:

- `Up` membuat objek dari nol.
- `Down` menghapus dalam urutan terbalik (child dulu).
- Gunakan `IF EXISTS` pada `Down` agar idempoten.
- Jangan memakai `CASCADE` pada `DROP TABLE` di `Down` kecuali benar-benar dipahami; lebih
  baik menghapus child secara eksplisit agar urutan dependency terlihat.
- Untuk migration yang mengubah data, `Down` harus mengembalikan data semaksimal mungkin
  atau mendokumentasikan bahwa rollback bersifat best-effort.

## 5. Transaksi

Goose membungkus setiap migration dalam transaksi secara default. Ini berarti:

- Jika satu statement gagal, seluruh migration rollback.
- `CREATE INDEX CONCURRENTLY` **tidak boleh** dalam transaksi.

Untuk migration dengan `CONCURRENTLY`:

```sql
-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_tasks_workspace_created ...
```

Risiko `NO TRANSACTION`: jika gagal di tengah, sebagian objek mungkin sudah dibuat dan Goose
tidak menandai migration selesai. Mitigasi:

- Gunakan `IF NOT EXISTS`.
- Jalankan satu index per statement/step bila perlu.
- Periksa `pg_index.indisvalid` setelah gagal; index invalid harus di-`DROP` lalu dibuat ulang.
- Di Phase 0–5, dataset masih kecil; index dapat dibuat dalam transaksi biasa. `CONCURRENTLY`
  disiapkan untuk production saat tabel sudah besar.

## 6. Migration Awal (Phase 1–6)

| Phase | Migration | Isi |
|---|---|---|
| 1 | 00001–00002 | users, user_sessions (schema dasar untuk auth) |
| 1 | 00003 | workspaces |
| 2 | — | Auth memakai 00001–00002; tidak ada migration baru |
| 3 | 00004–00005 | members, invitations |
| 4 | 00006–00010 | tasks, tags, labels, pivot |
| 5 | 00013 (sebagian) | Index cursor/view, trigram opsional |
| 6 | 00011–00012, 00013 | reminders, notifications, index worker |

Catatan: urutan nomor tidak harus sama dengan urutan Phase implementasi; yang penting
dependency. Pada Phase 1, migration 00001–00003 dapat dibuat sekaligus agar health check dan
auth memiliki schema. **Rekomendasi:** ikuti nomor file agar riwayat linear dan mudah
dibaca; Phase 2 tidak menambah tabel.

## 7. Menjalankan Migration di Development

### 7.1 Prasyarat

- Container PostgreSQL berjalan (`docker compose up -d postgres`).
- Env `DB_*` tersedia (lihat `.env.development`).

### 7.2 Perintah

```bash
# status
goose -dir ./migrations postgres "$DATABASE_URL" status

# up semua
goose -dir ./migrations postgres "$DATABASE_URL" up

# up satu
goose -dir ./migrations postgres "$DATABASE_URL" up-by-one

# down satu
goose -dir ./migrations postgres "$DATABASE_URL" down

# reset (hati-hati, hanya dev)
goose -dir ./migrations postgres "$DATABASE_URL" reset
```

`DATABASE_URL` dibentuk dari env:

```text
postgres://root:dev%40123@postgres:5432/todolist?sslmode=disable
```

Perhatikan password `dev@123` harus di-URL-encode menjadi `dev%40123`.

### 7.3 Otomatisasi Dev

- `scripts/migrate.sh` menjalankan `goose up` dengan env.
- `docker-compose.dev.yml` dapat menjalankan service `migrate` satu kali sebelum API.
- API **tidak** menjalankan migration otomatis. Alasan: menghindari race saat replika
  banyak dan memisahkan tanggung jawab.

## 8. Menjalankan Migration di Staging/Production

### 8.1 Prinsip

1. **Migration adalah langkah deploy terpisah**, bukan bagian dari startup API.
2. **Satu runner** yang menjalankan migration (job/init container), dengan lock dari Goose.
3. **Backup sebelum migration destruktif**.
4. **Review SQL** dan uji di staging dengan salinan data.
5. **Expand → migrate → contract** untuk perubahan besar (lihat §10).
6. **Timeout dan lock** diatur agar tidak memblokir trafik terlalu lama.

### 8.2 Alur Deploy

```mermaid
flowchart TD
    A[Build image] --> B[Backup DB / snapshot]
    B --> C[Jalankan migration job<br/>satu instance]
    C -->|gagal| D[Stop deploy, restore bila perlu]
    C -->|sukses| E[Deploy API baru]
    E --> F[Health check]
    F -->|gagal| G[Rollback API]
    F -->|sukses| H[Selesai]
```

### 8.3 Perintah

```bash
goose -dir /app/migrations postgres "$DATABASE_URL" up
goose -dir /app/migrations postgres "$DATABASE_URL" status
```

- Gunakan user database dengan privilege DDL hanya untuk job migration.
- User runtime API hanya memiliki `SELECT/INSERT/UPDATE/DELETE` (least privilege).
- Simpan log migration.
- Jika gagal, jangan biarkan API versi baru start (deploy pipeline harus berhenti).

### 8.4 Lock Timeout

Untuk migration pada tabel besar:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
```

Jika lock tidak didapat, migration gagal cepat dan dapat dijadwalkan ulang, bukan menggantung
dan memblokir query lain.

## 9. Strategi Perubahan Schema Tanpa Kehilangan Data

### 9.1 Menambah Kolom

1. `ALTER TABLE ... ADD COLUMN ... NULL` (tanpa default yang mahal) atau dengan default
   konstan (PostgreSQL 11+ cepat).
2. Backfill bertahap (batch) jika perlu.
3. Tambahkan constraint `NOT NULL` setelah backfill, atau gunakan `CHECK NOT VALID` lalu
   `VALIDATE CONSTRAINT`.

### 9.2 Mengubah Tipe

- Hindari `ALTER TYPE` langsung pada tabel besar (rewrite + lock).
- Gunakan kolom baru + backfill + switch aplikasi + hapus kolom lama.
- Untuk penambahan nilai enum (varchar + CHECK), cukup `DROP CONSTRAINT` + `ADD CONSTRAINT`
  dengan nilai baru; validasi ulang bisa mahal pada tabel besar. Gunakan `NOT VALID` lalu
  `VALIDATE`.

### 9.3 Rename

- Rename kolom/tabel adalah breaking change bagi aplikasi.
- Gunakan expand-contract: buat kolom baru, tulis ke keduanya, migrasi data, ubah kode,
  hapus kolom lama setelah satu rilis.

### 9.4 Menghapus Kolom

- Hapus setelah kode yang memakainya benar-benar tidak ada (minimal satu rilis).
- Jangan menghapus kolom yang masih direferensikan index/constraint tanpa menghapusnya dulu.

### 9.5 Menambah FK

```sql
ALTER TABLE child
  ADD CONSTRAINT fk_child_parent
  FOREIGN KEY (parent_id) REFERENCES parent(id)
  NOT VALID;

ALTER TABLE child VALIDATE CONSTRAINT fk_child_parent;
```

`NOT VALID` menghindari lock panjang saat penambahan; `VALIDATE` memakai lock lebih ringan.

### 9.6 Menambah Index

- Development: `CREATE INDEX` biasa.
- Production tabel besar: `CREATE INDEX CONCURRENTLY` di migration `NO TRANSACTION`.
- Index unik: buat index unik `CONCURRENTLY`, lalu `ALTER TABLE ... ADD CONSTRAINT UNIQUE
  USING INDEX`.

### 9.7 Backfill Data

- Batch 1.000–10.000 baris per transaksi.
- Hindari satu `UPDATE` besar yang mengunci tabel.
- Idempoten: `WHERE new_col IS NULL`.
- Monitor lag replika (jika ada).

## 10. Expand-Contract Pattern

Contoh perubahan `tasks.status` dari `TODO/IN_PROGRESS/DONE` menjadi menambah `BLOCKED`:

1. **Expand:** migration menambah nilai `BLOCKED` pada CHECK (atau melonggarkan constraint).
2. **Deploy aplikasi** yang mengenali `BLOCKED`.
3. **Contract:** tidak ada yang perlu dihapus. Jika mengganti nama status lama, baru lakukan
   backfill dan hapus nilai lama setelah aplikasi tidak memakainya.

Contoh menambah kolom `tasks.position`:

1. Migration: `ADD COLUMN position numeric NULL`.
2. Kode baru menulis `position` bila ada; kode lama tetap jalan (kolom nullable).
3. Backfill bertahap.
4. Setelah semua kode baru, tambahkan `NOT NULL`/default jika perlu.

## 11. Rollback

| Skenario | Tindakan |
|---|---|
| Migration belum dijalankan di production | Perbaiki file, jalankan ulang |
| Migration sudah jalan, schema kompatibel | Rollback aplikasi saja (tanpa `goose down`) |
| Migration sudah jalan, schema tidak kompatibel | `goose down` satu langkah + restore jika perlu |
| Data rusak | Restore dari backup/snapshot, bukan `down` |

Aturan: **rollback aplikasi tidak selalu berarti rollback database.** Database harus tetap
kompatibel dengan versi aplikasi sebelumnya (expand-contract). `goose down` hanya untuk
kesalahan migration yang belum melayani trafik atau di development.

## 12. Backup dan Restore

- Backup harian penuh + WAL archiving (Phase 9) untuk production.
- Sebelum migration destruktif: snapshot manual.
- Uji restore secara berkala.
- Simpan backup di storage terpisah dari database.
- Retensi minimum 7 hari (kebijakan final di Phase 9).

## 13. Seeder dan Fixture

| Kebutuhan | Lokasi | Cara |
|---|---|---|
| Development seed | `scripts/seed.sh` | Insert user/workspace/task contoh, idempoten |
| Integration test | `tests/fixtures` | Builder + truncate antar test |
| Production | Tidak ada | Tidak ada seed |

Seed **tidak** dijalankan sebagai migration. Untuk test, gunakan database terpisah
(`todolist_test`) dan reset schema per suite.

## 14. Checklist Migration

- [ ] Setiap file memiliki `Up` dan `Down`.
- [ ] Urutan sesuai dependency FK.
- [ ] Unique `(id, workspace_id)` dibuat sebelum pivot.
- [ ] Partial unique owner dan invitation pending ada.
- [ ] Semua index FK tercantum.
- [ ] Migration diuji dari database kosong (`up` semua).
- [ ] Migration diuji `down` satu per satu sampai kosong (minimal di CI).
- [ ] `up` setelah `down` menghasilkan schema identik.
- [ ] Tidak ada `AutoMigrate`.
- [ ] Production memakai job terpisah + backup.
- [ ] `CONCURRENTLY` untuk index tabel besar.
- [ ] `lock_timeout`/`statement_timeout` diatur.
- [ ] Log migration disimpan.
- [ ] Rollback aplikasi tidak memerlukan `down`.

## 15. Keputusan dan Trade-off

| Keputusan | Alasan | Alternatif |
|---|---|---|
| Goose SQL | Eksplisit, reviewable | GORM AutoMigrate (tidak aman), Atlas (tool baru) |
| 13 migration terpisah | Mudah dilacak & di-rollback | Satu migration besar (sulit rollback) |
| Index dipisah di 00013 | DDL tabel tetap ringkas | Index inline (lebih sulit diaudit) |
| Migration tidak otomatis saat start | Menghindari race multi-replica | Auto-migrate (risiko) |
| Expand-contract | Zero-downtime | Drop/rename langsung (downtime) |
| `CONCURRENTLY` untuk production | Hindari lock tulis | Index biasa (lock) |
| Seed di script | Tidak mencemari schema | Seed di migration |
