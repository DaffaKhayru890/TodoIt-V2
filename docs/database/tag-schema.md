# Skema Tag

Migration: `drizzle/0002_complex_logan.sql`. Migration Phase 1–3 tidak diubah.

## 1. tags

| Kolom | Tipe | Null | Keterangan |
| --- | --- | --- | --- |
| `id` | `uuid` | tidak | Primary key, `gen_random_uuid()`. |
| `workspace_id` | `uuid` | tidak | FK `workspaces(id)` `ON DELETE CASCADE`. |
| `name` | `varchar(50)` | tidak | Nama tampilan setelah trim. |
| `normalized_name` | `varchar(50)` | tidak | Trim + lowercase. |
| `created_by` | `uuid` | tidak | FK `users(id)`. |
| `created_at` | `timestamptz` | tidak | Waktu server. |
| `updated_at` | `timestamptz` | tidak | Waktu server, `>= created_at`. |

Constraint:

- `tags_workspace_id_normalized_name_uidx` unik pada `(workspace_id, normalized_name)`.
- Check panjang nama dan normalized name 1–50.
- Index `tags_workspace_id_idx`.

Nama `Backend` dan `backend` bentrok di workspace yang sama dan boleh sama di workspace berbeda.

## 2. todo_tags

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `todo_id` | `uuid` | FK `todos(id)` `ON DELETE CASCADE`. |
| `tag_id` | `uuid` | FK `tags(id)` `ON DELETE CASCADE`. |
| `created_at` | `timestamptz` | Waktu association dibuat. |

Primary key `(todo_id, tag_id)` mencegah association duplikat. Index `(tag_id, todo_id)` mendukung filter Todo berdasarkan tag dan penghapusan tag.

Menghapus Tag menghapus baris `todo_tags` dan tidak menghapus Todo. Menghapus Todo menghapus association dan tidak menghapus Tag.

Tidak ada composite foreign key `(todo_id, workspace_id)` karena `todo_tags` tidak menyimpan workspace. Use case `ReplaceTodoTags` dan `AddTodoTag` memuat Tag dengan `workspace_id` path di dalam transaksi yang sama sebelum insert. Test integrasi memastikan Tag workspace lain tidak menghasilkan baris association.
