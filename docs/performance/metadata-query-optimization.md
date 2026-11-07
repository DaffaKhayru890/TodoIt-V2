# Optimasi Query Metadata

Pengukuran di bawah dijalankan pada PostgreSQL lokal (`todo_test`) di dalam satu transaksi yang di-`ROLLBACK`. Dataset sementara: 200 tag, 40 label, 4.000 todo pada satu workspace, sekitar 8.000 association, dan 800 reminder absolute. `ANALYZE` dijalankan sebelum `EXPLAIN (ANALYZE, BUFFERS)`. Tidak ada baris benchmark yang tertinggal.

## 1. Index

| Akses | Index |
| --- | --- |
| Katalog tag/label per workspace | `tags_workspace_id_idx`, `labels_workspace_id_idx`, plus unique `(workspace_id, normalized_name)` |
| Listing tag `created_at DESC, id DESC` | unique/index workspace; pada 200 baris planner memilih sequential scan |
| Filter `labelId` + keyset | `todos_workspace_label_id_created_at_id_idx` |
| Filter `tagIds` | `todo_tags_tag_id_todo_id_idx` lewat `EXISTS` |
| Batch tag satu halaman | satu query `todo_tags` join `tags` untuk daftar `todo_id` |
| Reminder scheduled satu Todo | `reminders_todo_id_status_idx` |
| Cegah jadwal ganda | partial unique `reminders_absolute_schedule_uidx` dan `reminders_before_due_schedule_uidx` |

Pencarian `q` memakai `ILIKE` pada nama di dalam workspace. Tidak ada index trigram pada fase ini.

## 2. Hasil EXPLAIN ANALYZE

| Query | Rencana | Execution time |
| --- | --- | --- |
| List tag, limit 21 | Seq Scan 200 baris + sort/limit | **0,050 ms** |
| Filter label + keyset, limit 21 | Bitmap Index Scan `todos_workspace_label_id_created_at_id_idx` | **0,188 ms** |
| Reminder scheduled satu todo | Index Scan `reminders_todo_id_status_idx` | **0,086 ms** |
| Batch tag untuk 20 todo | Seq Scan `todo_tags` (8.002 baris) lalu Index Scan `tags_pkey` | **2,226 ms** |
| EXISTS tag (probe) | Bitmap Index Scan `todo_tags_tag_id_todo_id_idx` | **0,168 ms** |

Seq scan pada 200 tag dan pada association 8.000 baris adalah pilihan planner untuk tabel yang masih kecil, bukan ketiadaan index. Filter label dan lookup reminder sudah memakai index yang dibuat untuk akses tersebut.

## 3. N+1 dan duplikasi

`TodoMetadataService.load` memanggil `labels.findByIds` dan `tags.findByTodoIds` masing-masing paling banyak sekali per halaman. Tes unit menghitung pemanggilan itu untuk tiga Todo dan mengharapkan tepat satu batch.

Filter tag tidak men-join `todo_tags` ke baris Todo sebelum `LIMIT`. `EXISTS` menjaga satu Todo tetap satu baris meskipun punya banyak tag, sehingga cursor tidak melompat atau menduplikasi.

Listing reminder dibatasi `limit + 1` dan diurutkan ekspresi effective time, bukan dengan memuat seluruh riwayat ke memori aplikasi.
