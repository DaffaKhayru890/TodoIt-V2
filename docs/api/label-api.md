# API Label

Base path:

```text
/api/v1/workspaces/{workspaceId}/labels
```

## CRUD

| Method | Path | Peran | Sukses |
| --- | --- | --- | --- |
| `POST` | `/labels` | owner, admin | 201 |
| `GET` | `/labels` | member | 200 `{ items, pagination }` |
| `GET` | `/labels/{labelId}` | member | 200 |
| `PATCH` | `/labels/{labelId}` | owner, admin | 200 |
| `DELETE` | `/labels/{labelId}` | owner, admin | 204 |

Body create:

```json
{
  "name": "Personal",
  "color": "#3498DB",
  "description": "Personal tasks"
}
```

`color` wajib dan harus `#RRGGBB`. `#FFF`, `red`, dan `#GGGGGG` ditolak schema dengan **422**. Warna disimpan uppercase. `description` opsional, maksimal 300 karakter; `null` menghapus deskripsi. Minimal satu field pada `PATCH`.

Nama unik case-insensitive per workspace: duplikat **409 `LABEL_ALREADY_EXISTS`**.

Menghapus label mengosongkan `labelId` Todo terkait. Todo tetap dapat diambil.

## Assignment

Dua jalur memakai use case yang sama:

```http
PATCH /api/v1/workspaces/{workspaceId}/todos/{todoId}
{ "labelId": "label-uuid" }
```

`labelId: null` melepas label. Field yang tidak dikirim tidak mengubah label.

Jalur singkat:

```http
PUT    /api/v1/workspaces/{workspaceId}/todos/{todoId}/label
DELETE /api/v1/workspaces/{workspaceId}/todos/{todoId}/label
```

Keduanya mengembalikan `{ todo }` lengkap, termasuk `tags`. Semua member boleh assignment. Label workspace lain atau yang tidak ada menghasilkan **422 `TODO_LABEL_ASSIGNMENT_INVALID`**.

Setiap response Todo menyertakan `label` (object `{ id, name, color }` atau `null`) dan `tags` (array, kosong bila tidak ada).
