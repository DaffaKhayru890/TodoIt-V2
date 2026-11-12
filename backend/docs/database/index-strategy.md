# Database — Index Strategy

## 1. Tujuan

Memastikan query utama (list task dengan filter dan cursor, view tanggal, inbox notifikasi,
claim worker, cek membership) tetap cepat seiring pertumbuhan data, tanpa menambah index
yang tidak terpakai yang memperlambat write.

## 2. Prinsip

1. **Index mengikuti query nyata, bukan tebakan.** Setiap index harus memiliki query
   pemakai (lihat tabel §3).
2. **Composite index dengan urutan kolom sesuai filter → sort.**
3. **Partial index untuk subset kecil** (task belum selesai, notifikasi unread, reminder
   pending). Ini menjaga index tetap kecil.
4. **Covering index hanya jika terbukti perlu.** Hindari `INCLUDE` dini; ukur dulu.
5. **Unique index adalah constraint**, bukan sekadar performa.
6. **Jangan menduplikasi index.** Index `(workspace_id)` sudah tercakup oleh
   `(workspace_id, created_at, id)`.
7. **Index expression `lower(name)`** untuk keunikan case-insensitive.
8. **Tidak ada index pada kolom low-cardinality tunggal** (mis. `status` saja) kecuali
   partial dan dikombinasikan dengan workspace.

## 3. Query Utama dan Index Pendukung

| # | Query | Endpoint/Proses | Index |
|---|---|---|---|
| Q1 | Login by email | `POST /auth/login` | `ux_users_email_lower` |
| Q2 | Cek session aktif | Semua endpoint Bearer | PK `user_sessions(id)` |
| Q3 | Refresh token lookup | `POST /auth/refresh` | `ux_sessions_token_hash` |
| Q4 | Revoke family | Refresh reuse | `ix_sessions_family` |
| Q5 | List workspace user | `GET /workspaces` | `ix_members_user` + PK workspaces |
| Q6 | Cek membership | Semua operasi workspace | `ux_members_workspace_user` |
| Q7 | List member | `GET /members` | `ix_members_workspace_role` / PK |
| Q8 | Cek undangan pending | Create invitation | `ux_invitations_pending_email` |
| Q9 | Accept invitation | `POST /invitations/{token}/accept` | `ux_invitations_token_hash` |
| Q10 | List task default | `GET /tasks` | `ix_tasks_workspace_created` |
| Q11 | Today/Upcoming/Overdue | View task | `ix_tasks_workspace_due` |
| Q12 | Filter status | `GET /tasks?status=` | `ix_tasks_workspace_status_created` |
| Q13 | Filter priority | `GET /tasks?priority=` | `ix_tasks_workspace_priority` |
| Q14 | Filter assignee | `GET /tasks?assignee_id=` | `ix_tasks_workspace_assignee` |
| Q15 | Filter tag | `GET /tasks?tag_ids=` | `ix_task_tags_tag` |
| Q16 | Filter label | `GET /tasks?label_ids=` | `ix_task_labels_label` |
| Q17 | Sort updated_at | `GET /tasks?sort=updated_at` | `ix_tasks_workspace_updated` |
| Q18 | Claim reminder | Worker | `ix_reminders_due` |
| Q19 | List reminder task | `GET .../reminders` | `ix_reminders_task` |
| Q20 | Stale lock recovery | Worker | `ix_reminders_stale` |
| Q21 | Inbox notifikasi | `GET /notifications` | `ix_notifications_user_created` |
| Q22 | Badge unread | `GET /notifications?unread=true` | `ix_notifications_unread` |
| Q23 | Dedupe notifikasi | Worker | `ux_notifications_dedupe` |
| Q24 | Due soon/overdue scan | Worker | `ix_tasks_worker_due` |

## 4. Daftar Index Final

### 4.1 `users`

```sql
CREATE UNIQUE INDEX ux_users_email_lower
    ON users (lower(email))
    WHERE deleted_at IS NULL;

CREATE INDEX ix_users_deleted_at
    ON users (deleted_at)
    WHERE deleted_at IS NOT NULL;
```

| Index | Alasan |
|---|---|
| `ux_users_email_lower` | Login + integritas. Expression karena email case-insensitive. Partial agar email dapat dipakai ulang setelah soft delete. |
| `ix_users_deleted_at` | Housekeeping akun terhapus; partial agar hanya berisi baris terhapus. |

Tidak ada index `email` biasa karena duplikasi dengan expression index.

### 4.2 `user_sessions`

```sql
CREATE UNIQUE INDEX ux_sessions_token_hash
    ON user_sessions (refresh_token_hash);

CREATE INDEX ix_sessions_user
    ON user_sessions (user_id);

CREATE INDEX ix_sessions_family
    ON user_sessions (family_id);

CREATE INDEX ix_sessions_expires
    ON user_sessions (expires_at)
    WHERE revoked_at IS NULL;
```

| Index | Alasan |
|---|---|
| `ux_sessions_token_hash` | Lookup refresh O(1), sekaligus unique constraint |
| `ix_sessions_user` | Logout-all, cascade delete user, dan daftar session. Non-partial agar juga melayani FK |
| `ix_sessions_family` | Revoke family saat reuse detection |
| `ix_sessions_expires` | Pembersihan session kedaluwarsa (housekeeping) |

Catatan: `SELECT session WHERE id = ? AND revoked_at IS NULL` memakai PK; tidak perlu index
tambahan.

### 4.3 `workspaces`

```sql
CREATE INDEX ix_workspaces_owner
    ON workspaces (owner_id)
    WHERE deleted_at IS NULL;
```

Tidak ada index `name` karena tidak ada pencarian nama workspace pada Phase 0 (dan nama tidak
unik). List workspace berasal dari membership, bukan owner. Index owner dipakai untuk
kebutuhan owner-specific/audit. Jika tidak terpakai, boleh dihapus pada Phase 9 setelah
observasi.

### 4.4 `workspace_members`

```sql
CREATE UNIQUE INDEX ux_members_workspace_user
    ON workspace_members (workspace_id, user_id);

CREATE UNIQUE INDEX ux_members_single_owner
    ON workspace_members (workspace_id)
    WHERE role = 'OWNER';

CREATE INDEX ix_members_user
    ON workspace_members (user_id, workspace_id);

CREATE INDEX ix_members_workspace_role
    ON workspace_members (workspace_id, role);
```

| Index | Alasan |
|---|---|
| `ux_members_workspace_user` | Cek akses + integritas. Urutan `(workspace_id, user_id)` sesuai query guard |
| `ux_members_single_owner` | Menjamin tepat satu OWNER; juga mempercepat cek owner |
| `ix_members_user` | `GET /workspaces` mencari membership berdasarkan user |
| `ix_members_workspace_role` | List member, filter role |

### 4.5 `workspace_invitations`

```sql
CREATE UNIQUE INDEX ux_invitations_token_hash
    ON workspace_invitations (token_hash);

CREATE UNIQUE INDEX ux_invitations_pending_email
    ON workspace_invitations (workspace_id, lower(email))
    WHERE status = 'PENDING';

CREATE INDEX ix_invitations_workspace_created
    ON workspace_invitations (workspace_id, created_at DESC, id DESC);

CREATE INDEX ix_invitations_status_expires
    ON workspace_invitations (status, expires_at)
    WHERE status = 'PENDING';
```

| Index | Alasan |
|---|---|
| `ux_invitations_token_hash` | Accept lookup |
| `ux_invitations_pending_email` | Cegah undangan ganda; partial agar undangan selesai tidak menghalangi undangan baru |
| `ix_invitations_workspace_created` | List + cursor |
| `ix_invitations_status_expires` | Penandaan EXPIRED |

### 4.6 `tasks`

```sql
-- List default: created_at DESC, id DESC
CREATE INDEX ix_tasks_workspace_created
    ON tasks (workspace_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Today / Upcoming / Overdue
CREATE INDEX ix_tasks_workspace_due
    ON tasks (workspace_id, due_at ASC, id ASC)
    WHERE deleted_at IS NULL AND status <> 'DONE';

-- Filter status
CREATE INDEX ix_tasks_workspace_status_created
    ON tasks (workspace_id, status, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Filter priority
CREATE INDEX ix_tasks_workspace_priority
    ON tasks (workspace_id, priority, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Filter assignee
CREATE INDEX ix_tasks_workspace_assignee
    ON tasks (workspace_id, assignee_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Sort updated_at
CREATE INDEX ix_tasks_workspace_updated
    ON tasks (workspace_id, updated_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- Worker due soon/overdue (lintas workspace)
CREATE INDEX ix_tasks_worker_due
    ON tasks (due_at, id)
    WHERE status <> 'DONE' AND deleted_at IS NULL;
```

#### Mengapa `due_at` Memakai `ASC` dan Bukan `DESC`

View Today/Upcoming/Overdue menampilkan task paling dekat tenggat lebih dulu. Index ascending
mendukung `ORDER BY due_at ASC, id ASC` dan range scan `due_at >= x AND due_at < y`.
PostgreSQL dapat memindai index mundur untuk `DESC`, tetapi membuat index sesuai arah
dominan lebih baik.

#### Mengapa Partial `status <> 'DONE'`

View tanggal dan overdue tidak pernah menampilkan task selesai. Partial index mengurangi
ukuran secara signifikan pada workspace yang produktif. Konsekuensinya, query **wajib**
menyertakan `status <> 'DONE'` agar planner dapat memakai index; jika tidak, planner memakai
index lain.

#### Mengapa Tidak Ada Index `(workspace_id, due_at)` Tanpa Partial

Task selesai juga memiliki `due_at`; tanpa partial, index membesar tanpa manfaat untuk view.
Task selesai yang perlu diurutkan due date dapat memakai `ix_tasks_workspace_created` atau
filter status.

#### Search `q`

Untuk Phase 5, `q` memakai `ILIKE '%...%'` yang **tidak** dapat memakai B-tree. Dataset
per workspace relatif kecil, sehingga sequential scan terbatas workspace masih dapat
diterima. Jika perlu, Phase 9 menambahkan:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_tasks_title_trgm
    ON tasks USING gin (title gin_trgm_ops)
    WHERE deleted_at IS NULL;
```

Index trigram tidak dibuat pada Phase 0 karena menambah extension dan biaya write. Keputusan:
tunda sampai ada bukti kebutuhan.

### 4.7 `tags`

```sql
CREATE UNIQUE INDEX ux_tags_workspace_name
    ON tags (workspace_id, lower(name));

CREATE INDEX ix_tags_workspace_name
    ON tags (workspace_id, name);
```

- `ux_tags_workspace_name` menjaga keunikan case-insensitive dan mendukung lookup nama.
- `ix_tags_workspace_name` mendukung list terurut nama. Keduanya bisa dianggap duplikatif;
  jika ingin minimal, hapus `ix_tags_workspace_name` dan andalkan sort in-memory untuk
  dataset kecil (puluhan tag). **Keputusan Phase 0:** pertahankan keduanya sampai ada
  pengukuran; list tag kecil sehingga index kedua murah.

### 4.8 `labels`

```sql
CREATE UNIQUE INDEX ux_labels_workspace_name
    ON labels (workspace_id, lower(name));

CREATE INDEX ix_labels_workspace_name
    ON labels (workspace_id, name);
```

Alasan sama dengan tag.

### 4.9 `task_tags`

```sql
-- PK (task_id, tag_id) sudah membuat index task_id
CREATE INDEX ix_task_tags_tag
    ON task_tags (tag_id, workspace_id);

CREATE INDEX ix_task_tags_workspace
    ON task_tags (workspace_id, task_id);
```

| Index | Alasan |
|---|---|
| PK `(task_id, tag_id)` | Cek duplikat, hapus pivot per task, load tag per task |
| `ix_task_tags_tag` | Filter task berdasarkan tag (join dari tag ke task) |
| `ix_task_tags_workspace` | Query per workspace dan validasi composite FK |

Composite FK `(tag_id, workspace_id) → tags(id, workspace_id)` membutuhkan index pada sisi
referencing `(tag_id, workspace_id)` agar delete/update pada `tags` tidak memicu sequential
scan. Karena itu `ix_task_tags_tag` wajib, bukan opsional.

Hal yang sama berlaku untuk `(task_id, workspace_id)` → `tasks`, tetapi PK
`(task_id, tag_id)` sudah memiliki `task_id` sebagai kolom pertama sehingga cukup untuk
lookup task; PostgreSQL tetap membutuhkan index yang mencakup `workspace_id` untuk FK
composite. Karena itu `ix_task_tags_workspace` ditambahkan.

### 4.10 `task_labels`

```sql
CREATE INDEX ix_task_labels_label
    ON task_labels (label_id, workspace_id);

CREATE INDEX ix_task_labels_workspace
    ON task_labels (workspace_id, task_id);
```

### 4.11 `reminders`

```sql
CREATE INDEX ix_reminders_due
    ON reminders (scheduled_at, id)
    WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX ix_reminders_task
    ON reminders (task_id, scheduled_at, id);

CREATE INDEX ix_reminders_workspace
    ON reminders (workspace_id, scheduled_at DESC, id DESC);

CREATE INDEX ix_reminders_stale
    ON reminders (locked_at)
    WHERE status = 'PROCESSING';
```

| Index | Alasan |
|---|---|
| `ix_reminders_due` | Claim worker: `scheduled_at <= now()` + status. Partial menjaga index hanya berisi job aktif |
| `ix_reminders_task` | List reminder per task + composite FK task |
| `ix_reminders_workspace` | Observasi/ops |
| `ix_reminders_stale` | Recovery job `PROCESSING` yang macet |

Catatan: unique `(task_id, scheduled_at)` membuat index tambahan; index tersebut juga dapat
membantu list per task. `ix_reminders_task` tetap berguna karena mencakup `id` untuk cursor
dan urutan yang sama.

### 4.12 `notifications`

```sql
CREATE UNIQUE INDEX ux_notifications_dedupe
    ON notifications (dedupe_key);

CREATE INDEX ix_notifications_user_created
    ON notifications (user_id, created_at DESC, id DESC);

CREATE INDEX ix_notifications_unread
    ON notifications (user_id, created_at DESC, id DESC)
    WHERE read_at IS NULL;

CREATE INDEX ix_notifications_workspace
    ON notifications (workspace_id, created_at DESC, id DESC);
```

| Index | Alasan |
|---|---|
| `ux_notifications_dedupe` | Idempotensi worker, `ON CONFLICT` |
| `ix_notifications_user_created` | Inbox + cursor |
| `ix_notifications_unread` | Badge/unread filter; partial kecil |
| `ix_notifications_workspace` | Filter workspace (opsional, untuk analitik/ops) |

`ix_notifications_workspace` dapat dihapus jika tidak ada query yang memakainya. Pada Phase 0
endpoint mendukung filter `workspace_id`, jadi index dipertahankan.

## 5. Pola Keyset Pagination dan Index

### 5.1 Default List

```sql
SELECT id, workspace_id, title, status, priority, due_at, created_at
FROM tasks
WHERE workspace_id = $1
  AND deleted_at IS NULL
  AND (created_at, id) < ($2, $3)   -- cursor DESC
ORDER BY created_at DESC, id DESC
LIMIT $4;
```

Index `(workspace_id, created_at DESC, id DESC) WHERE deleted_at IS NULL` mendukung
`Index Scan` + `Limit` tanpa sort.

### 5.2 Filter Status + Cursor

```sql
WHERE workspace_id = $1
  AND status = ANY($2)
  AND deleted_at IS NULL
  AND (created_at, id) < ($3, $4)
ORDER BY created_at DESC, id DESC
```

Index `(workspace_id, status, created_at DESC, id DESC)`. Jika filter status memakai banyak
nilai (`ANY`), PostgreSQL dapat memakai index dengan `Bitmap Heap Scan` atau `Index Scan`
per nilai. Untuk dua–tiga nilai, umumnya baik.

### 5.3 Due Date + Cursor

```sql
WHERE workspace_id = $1
  AND due_at >= $2 AND due_at < $3
  AND status <> 'DONE'
  AND deleted_at IS NULL
  AND (due_at, id) > ($4, $5)
ORDER BY due_at ASC, id ASC
```

Index `(workspace_id, due_at ASC, id ASC) WHERE deleted_at IS NULL AND status <> 'DONE'`
mendukung range + keyset.

### 5.4 Sort `due_at` dengan NULL

`due_at` nullable. PostgreSQL default `NULLS LAST` untuk `ASC`? Sebenarnya default adalah
`NULLS LAST` untuk `ASC` dan `NULLS FIRST` untuk `DESC`. Keyset dengan NULL membutuhkan
penanganan khusus. Karena itu:

- Sort `due_at` **hanya** dipakai pada list yang memfilter `due_at IS NOT NULL` (view) atau
  menggunakan `NULLS LAST` eksplisit.
- Cursor untuk `due_at` menolak nilai `k = null` dan menggunakan predikat tambahan
  `due_at IS NOT NULL`.
- Untuk list umum, default sort `created_at` (non-null) agar tidak ada kompleksitas NULL.

Detail di [`../api/cursor-pagination.md`](../api/cursor-pagination.md).

## 6. Index yang Sengaja Tidak Dibuat

| Index | Alasan tidak dibuat |
|---|---|
| `tasks(status)` tunggal | Low cardinality, tidak selektif |
| `tasks(due_at)` tunggal | Partial composite lebih berguna |
| `notifications(read_at)` | Low cardinality; partial unread lebih baik |
| `workspaces(name)` | Tidak ada pencarian nama; tidak unik |
| `users(name)` | Tidak ada fitur pencarian user |
| GIN trigram `tasks.title` | Ditunda sampai ada kebutuhan terbukti |
| `task_tags(workspace_id)` tunggal | Tercakup `(workspace_id, task_id)` |
| `reminders(status)` tunggal | Partial due/stale lebih baik |

## 7. Biaya Write

Setiap index menambah biaya `INSERT`/`UPDATE`. Estimasi untuk `tasks`:

- 7 index pada `tasks` (termasuk PK dan unique) → setiap insert menulis 7 struktur.
- Partial index hanya menulis jika predikat terpenuhi; task DONE tidak masuk
  `ix_tasks_workspace_due`, sehingga update status dari TODO ke DONE menghapus entri dari
  index partial (biaya kecil, bermanfaat besar untuk ukuran index).

Prinsip: jika setelah Phase 5 ada index yang tidak pernah muncul di `pg_stat_user_indexes`
dengan `idx_scan > 0`, evaluasi untuk dihapus.

Query monitoring:

```sql
SELECT relname, indexrelname, idx_scan, idx_tup_read, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

## 8. Index untuk Foreign Key

PostgreSQL **tidak** otomatis membuat index pada sisi referencing FK. Tanpa index:

- `DELETE`/`UPDATE` pada tabel parent memicu sequential scan pada child.
- Query join/filter child lambat.

Index yang wajib karena FK:

| Child | FK | Index |
|---|---|---|
| `user_sessions` | `user_id` | `ix_sessions_user` (non-partial, melayani cascade dan logout-all) |
| `workspace_members` | `workspace_id`, `user_id` | `ux_members_workspace_user`, `ix_members_user` |
| `workspace_invitations` | `workspace_id`, `invited_by` | `ix_invitations_workspace_created`; tambahkan `ix_invitations_invited_by` |
| `tasks` | `workspace_id`, `created_by`, `assignee_id` | `ix_tasks_workspace_*`, `ix_tasks_created_by`, `ix_tasks_assignee_id` |
| `tags`, `labels` | `workspace_id` | `ix_tags_workspace_name`, `ix_labels_workspace_name` |
| `task_tags` | `task_id`, `tag_id` | PK + `ix_task_tags_tag` |
| `task_labels` | `task_id`, `label_id` | PK + `ix_task_labels_label` |
| `reminders` | `task_id`, `user_id`, `workspace_id` | `ix_reminders_task`, `ix_reminders_user`, `ix_reminders_workspace` |
| `notifications` | `user_id`, `workspace_id`, `task_id` | `ix_notifications_user_created`, `ix_notifications_workspace`, `ix_notifications_task` |

### Index FK Tambahan

Index berikut melengkapi daftar di atas agar setiap foreign key memiliki index di sisi
referencing:

```sql
-- FK invited_by
CREATE INDEX ix_invitations_invited_by ON workspace_invitations (invited_by);

-- FK tasks.created_by / assignee
CREATE INDEX ix_tasks_created_by ON tasks (created_by);
CREATE INDEX ix_tasks_assignee_id ON tasks (assignee_id);

-- FK reminders.user_id
CREATE INDEX ix_reminders_user ON reminders (user_id);

-- FK notifications.task_id
CREATE INDEX ix_notifications_task ON notifications (task_id);
```

`ix_sessions_user` (non-partial) sudah ditetapkan pada §4.2. Index tersebut melayani
logout-all (`WHERE user_id=? AND revoked_at IS NULL`, filter dilakukan setelah index scan)
sekaligus cascade delete user, sehingga tidak perlu index partial terpisah.

## 9. Urutan Pembuatan Index

Index dibuat setelah tabel dan constraint, dalam migration `00013_indexes_and_hardening.sql`:

1. Unique index (constraint) — harus ada sebelum data masuk.
2. Index FK.
3. Index query list/cursor.
4. Partial index worker.
5. Index opsional (trigram) — tidak pada Phase 0.

Untuk tabel besar di production, gunakan `CREATE INDEX CONCURRENTLY` (lihat
`migrations.md`). Index unique tidak dapat dibuat `CONCURRENTLY` di dalam transaksi tanpa
penanganan khusus; jalankan sebagai migration `NO TRANSACTION` jika perlu.

## 10. Validasi Index

Test integrasi Phase 5/6 wajib:

| Test | Cara |
|---|---|
| Cursor list memakai index | `EXPLAIN (ANALYZE, BUFFERS)` memastikan `Index Scan`, bukan `Seq Scan` |
| Today memakai partial due | `EXPLAIN` menunjukkan `ix_tasks_workspace_due` |
| Claim reminder memakai partial | `EXPLAIN` menunjukkan `ix_reminders_due` |
| Tidak ada index duplikat | Query `pg_indexes` + review |
| Index FK lengkap | Query katalog untuk setiap FK |

Contoh ekspektasi:

```text
Limit  (cost=0.42..12.3 rows=20)
  ->  Index Scan using ix_tasks_workspace_created on tasks
        Index Cond: (workspace_id = '...'::uuid)
        Filter: (deleted_at IS NULL)
```

Jika muncul `Seq Scan` pada tabel > 100k baris, investigasi statistik (`ANALYZE`), predikat
yang tidak cocok dengan partial index, atau urutan kolom.

## 11. Maintenance

| Tugas | Frekuensi | Catatan |
|---|---|---|
| `ANALYZE` | Otomatis (autovacuum) | Setelah bulk migration, jalankan manual |
| `REINDEX CONCURRENTLY` | Jika bloat | Phase 9 |
| Hapus index tidak terpakai | Setelah 1 bulan produksi | Berdasarkan `pg_stat_user_indexes` |
| Monitoring ukuran index | Mingguan | `pg_relation_size` |
| Deteksi index invalid | Setelah `CONCURRENTLY` gagal | `pg_index.indisvalid` |

## 12. Ringkasan Keputusan

| Keputusan | Alasan |
|---|---|
| Composite + partial untuk task | Filter workspace + status + cursor |
| Partial index worker | Job aktif jauh lebih sedikit dari total |
| Expression index `lower()` | Case-insensitive unique/logup |
| FK index eksplisit | Hindari seq scan saat delete parent |
| Trigram ditunda | Biaya write vs manfaat belum terbukti |
| Tidak ada index status tunggal | Tidak selektif |
| `ix_sessions_user` non-partial | Melayani cascade dan logout-all |
| Index `due_at` ascending | Sesuai urutan tampilan |
