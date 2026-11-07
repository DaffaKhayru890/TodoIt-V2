# Optimasi Query Todo

Dokumen ini menjelaskan index dan hasil **EXPLAIN ANALYZE** nyata untuk query Phase 3. Semua pengukuran dilakukan pada PostgreSQL lokal di Docker (`todo-postgres`), dengan data benchmark yang dibuat di dalam transaksi lalu di-`ROLLBACK`. Tidak ada data benchmark yang tertinggal di database.

## 1. Prinsip

1. **Keyset, bukan OFFSET.** Halaman berikutnya memakai `(created_at, id)` sehingga tidak perlu memindai dan membuang N baris.
2. **Partial index.** Semua query bisnis hanya membaca `deleted_at IS NULL`, sehingga index utama memakai predikat yang sama.
3. **Index mengikuti urutan query.** Index listing memuat `created_at DESC, id DESC` agar urutan tidak memerlukan sort besar.
4. **Index due date terpisah.** Today/Upcoming/Overdue memakai rentang `due_at`.
5. **Tidak ada index pencarian trigram pada Phase 3.** Pencarian `ILIKE '%...%'` belum dioptimalkan untuk dataset teks besar; ini dicatat sebagai batas, bukan diklaim sebagai sudah optimal.

## 2. Query dan index

| Query | Predikat utama | Index yang relevan |
| --- | --- | --- |
| Listing default | `workspace_id`, `deleted_at IS NULL` | `todos_workspace_created_at_id_idx` |
| Keyset page | keyset `(created_at, id)` | `todos_workspace_created_at_id_idx` |
| Filter status | `status = ?` | `todos_workspace_status_created_at_id_idx` |
| Filter priority | `priority = ?` | `todos_workspace_priority_created_at_id_idx` |
| Today/Upcoming | rentang `due_at` | `todos_workspace_due_at_idx` |
| Overdue | `due_at < ?` | `todos_workspace_due_at_idx` |
| Search | `title/description ILIKE '%?%'` | index workspace, lalu filter heap |

## 3. Benchmark multitenant (100 workspace, 50.000 todo)

Dataset:

- 100 workspace.
- 50.000 todo, tersebar ~500 per workspace.
- 10% `completed`, ~6% `cancelled`, ~20% `in_progress`, sisanya `todo`.
- Sebagian baris soft-deleted.
- Target workspace memiliki 500 baris aktif.

Perintah inti:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM todos
WHERE workspace_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT 21;
```

Hasil aktual:

| # | Query | Rencana yang dipilih | Baris diproses | Execution time | Shared buffers |
| --- | --- | --- | --- | --- | --- |
| 1 | Default listing, limit 21 | Bitmap Index Scan `todos_workspace_due_at_idx` → Bitmap Heap → top-N sort | 500 | **0,593 ms** | 502 |
| 2 | Keyset cursor, limit 21 | BitmapOr pada `todos_workspace_created_at_id_idx` → Bitmap Heap → top-N sort | 251 | **0,296 ms** | 264 |
| 3 | Filter `status = 'todo'`, limit 21 | Bitmap Index Scan `todos_workspace_status_created_at_id_idx` → Bitmap Heap → sort | 471 | **0,546 ms** | 487 |
| 4 | Filter `priority = 'high'`, limit 21 | Bitmap Index Scan `todos_workspace_priority_created_at_id_idx` → Bitmap Heap → sort | 71 | **0,132 ms** | 75 |
| 5 | Today (`due_at` range), limit 21 | Bitmap Index Scan `todos_workspace_due_at_idx` → Bitmap Heap | 0 | **0,047 ms** | 2 |
| 6 | Overdue (`due_at < ...`), limit 21 | Bitmap Index Scan `todos_workspace_due_at_idx` → Bitmap Heap → filter status → sort | 333 | **0,351 ms** | 335 |
| 7 | Search `ILIKE '%benchmark 250%'`, limit 21 | Bitmap Index Scan index workspace → Bitmap Heap → filter ILIKE → sort | 500 | **0,642 ms** | 502 |

Catatan:

- Query Today mengembalikan 0 baris karena distribusi `due_at` pada dataset benchmark tidak menempatkan deadline di tanggal target untuk workspace tersebut. Rencana tetap menunjukkan index `due_at` dipakai.
- Query 1 memilih index `due_at` untuk filter workspace, bukan index `created_at`, karena planner memperkirakan bitmap + sort 500 baris lebih murah. Ini bukan masalah: jumlah baris per tenant kecil dan keyset tetap membatasi hasil. Pada tenant yang jauh lebih besar, index `created_at` menjadi lebih relevan.
- Query 2 menunjukkan pola keyset yang diinginkan: dua cabang `BitmapOr` pada index `(workspace_id, created_at DESC, id DESC)`.

## 4. Benchmark satu workspace besar (50.000 todo)

Dataset pertama menempatkan seluruh 50.000 todo di satu workspace. Hasil ini memperlihatkan perilaku planner ketika satu tenant mendominasi tabel:

| Query | Rencana | Execution time |
| --- | --- | --- |
| Default listing | Seq Scan + top-N sort | **15,350 ms** |
| Keyset page | Seq Scan + top-N sort | **11,439 ms** |
| Status `todo` | Seq Scan + top-N sort | **14,297 ms** |
| Priority `high` | Bitmap Index Scan priority + sort | **4,206 ms** |
| Today | Bitmap Index Scan due_at | **0,864 ms** |
| Overdue | Bitmap Index Scan due_at + filter + sort | **10,120 ms** |
| Search | Seq Scan + filter ILIKE | **37,537 ms** |

Pelajarannya:

- Ketika satu workspace memiliki hampir seluruh baris tabel, sequential scan bisa lebih murah daripada index scan. Ini keputusan planner yang wajar, bukan tanda index rusak.
- Filter yang sangat selektif (`priority = 'high'`) tetap memakai index.
- Pencarian substring adalah operasi termahal karena tidak ada index trigram.

## 5. Analisis

### Kekuatan

- Keyset pagination menghindari `OFFSET`, sehingga halaman ke-1000 tidak memindai 20.000 baris terlebih dahulu.
- Partial index `deleted_at IS NULL` menjaga index tetap kecil dan relevan.
- Index status/priority memuat kolom urutan, sehingga filter dan keyset dapat dilayani oleh index yang sama.
- Index `due_at` efektif untuk rentang Today/Upcoming/Overdue.

### Keterbatasan

- Search `ILIKE '%...%'` tidak dapat memakai B-tree. Pada dataset besar, biaya naik linear terhadap jumlah baris workspace.
- Default listing dapat memilih index workspace mana pun yang tersedia, lalu melakukan sort kecil. Ini masih cepat untuk ratusan baris per tenant.
- Tidak ada index penutup (covering index) yang memuat seluruh kolom `SELECT *`; heap fetch tetap diperlukan.
- `ORDER BY priority` tidak didukung, sehingga tidak ada index khusus untuk itu.

## 6. Rekomendasi lanjutan (belum diterapkan)

1. **Trigram index** bila volume teks besar:

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX todos_title_trgm_idx ON todos USING gin (title gin_trgm_ops)
     WHERE deleted_at IS NULL;
   CREATE INDEX todos_description_trgm_idx ON todos USING gin (description gin_trgm_ops)
     WHERE deleted_at IS NULL;
   ```

   Ukur biaya tulis dan ukuran index sebelum menerapkan.

2. **Composite index status + due_at** bila pola Today/Overdue dengan filter status menjadi dominan:

   ```sql
   CREATE INDEX todos_workspace_status_due_at_idx
     ON todos (workspace_id, status, due_at)
     WHERE deleted_at IS NULL;
   ```

3. **Index-only listing** bila `SELECT` dipersempit dan kolom yang dikembalikan dimasukkan ke `INCLUDE`.

4. **Monitoring**: aktifkan `pg_stat_statements`, pantau `pg_stat_user_indexes`, dan jalankan `ANALYZE` setelah perubahan data besar.

5. **Arsip data lama** bila tabel tumbuh sangat besar; soft-deleted row dapat dipindahkan ke tabel arsip setelah kebijakan retensi ditetapkan.

## 7. Cara mereproduksi

```bash
# Jalankan benchmark dalam transaksi lalu rollback
docker exec -i todo-postgres psql -U root -d todo_development <<'SQL'
BEGIN;
-- seed user/workspace/todos
ANALYZE todos;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
ROLLBACK;
SQL
```

Angka di atas bergantung pada versi PostgreSQL, hardware, cache, dan distribusi data. Gunakan sebagai indikasi pola rencana, bukan SLA produksi.
