# Skema Label

Migration: `drizzle/0002_complex_logan.sql`.

## 1. labels

| Kolom | Tipe | Null | Keterangan |
| --- | --- | --- | --- |
| `id` | `uuid` | tidak | Primary key. |
| `workspace_id` | `uuid` | tidak | FK `workspaces(id)` `ON DELETE CASCADE`. |
| `name` | `varchar(50)` | tidak | Nama tampilan. |
| `normalized_name` | `varchar(50)` | tidak | Trim + lowercase, unik per workspace. |
| `color` | `varchar(7)` | tidak | Check `^#[0-9A-F]{6}$`. |
| `description` | `varchar(300)` | ya | Maksimal 300 karakter. |
| `created_by` | `uuid` | tidak | FK `users(id)`. |
| `created_at` / `updated_at` | `timestamptz` | tidak | `updated_at >= created_at`. |

Index:

- unik `(workspace_id, normalized_name)`;
- `workspace_id`.

Domain menyimpan warna dalam huruf kapital. `#3498db` menjadi `#3498DB` sebelum insert, sehingga check constraint database terpenuhi.

## 2. Hubungan ke Todo

`todos.label_id` nullable, FK ke `labels(id)` dengan `ON DELETE SET NULL`.

Menghapus Label:

- menghapus baris label;
- mengosongkan `label_id` pada Todo yang memakainya;
- tidak menghapus Todo dan tidak mengubah title, status, atau tag.

Index `todos_workspace_label_id_created_at_id_idx` (partial `deleted_at IS NULL`) mendukung filter `labelId` pada listing.

Application tetap menolak Label dari workspace lain sebelum menulis `label_id`, karena foreign key sendiri tidak membawa `workspace_id`.
