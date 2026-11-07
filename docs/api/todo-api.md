# API Todo (Phase 3)

Semua endpoint Todo berada di bawah:

```text
/api/v1/workspaces/{workspaceId}/todos
```

Setiap request wajib menyertakan access token:

```http
Authorization: Bearer <access_token>
```

`workspaceId` harus berupa UUID dan user harus member workspace yang belum diarsipkan. Pelanggaran menghasilkan **404 `WORKSPACE_ACCESS_DENIED`** (bukan 403) untuk mencegah enumerasi workspace.

## 1. Ringkasan endpoint

| Method | Path | Deskripsi | Sukses |
| --- | --- | --- | --- |
| `POST` | `/` | Membuat todo. | `201 { todo }` |
| `GET` | `/` | Listing dengan filter dan cursor pagination. | `200 { items, pagination }` |
| `GET` | `/today` | Todo yang jatuh tempo hari ini. | `200 { items, pagination }` |
| `GET` | `/upcoming` | Todo dalam rentang hari mendatang. | `200 { items, pagination }` |
| `GET` | `/overdue` | Todo yang sudah melewati awal hari ini. | `200 { items, pagination }` |
| `GET` | `/{todoId}` | Detail satu todo aktif. | `200 { todo }` |
| `PATCH` | `/{todoId}` | Update sebagian field. | `200 { todo }` |
| `PATCH` | `/{todoId}/complete` | Shortcut menyelesaikan todo (idempoten). | `200 { todo }` |
| `DELETE` | `/{todoId}` | Soft delete (idempoten). | `204` tanpa body |

Route statis (`today`, `upcoming`, `overdue`) didaftarkan sebelum `/{todoId}` agar tidak tertangkap sebagai id.

## 2. Bentuk Todo

```json
{
  "todo": {
    "id": "0f7e0d3a-4d3c-4f6e-9a7e-1a2b3c4d5e6f",
    "workspaceId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "title": "Belajar PostgreSQL",
    "description": "Indexing dan keyset pagination",
    "status": "todo",
    "priority": "high",
    "dueAt": "2026-11-10T02:00:00.000Z",
    "completedAt": null,
    "label": null,
    "tags": [],
    "createdBy": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-11-07T10:00:00.000Z",
    "updatedAt": "2026-11-07T10:00:00.000Z"
  }
}
```

`deletedAt` tidak pernah dikirim. Todo yang sudah dihapus diperlakukan sebagai tidak ada.

## 3. Membuat todo

`POST /api/v1/workspaces/{workspaceId}/todos`

### Body

| Field | Wajib | Aturan |
| --- | --- | --- |
| `title` | ya | String 1–200 karakter setelah trim. |
| `description` | tidak | String maksimal 5.000 karakter, atau `null`. |
| `priority` | tidak | `low` (default), `medium`, `high`, `urgent`. |
| `dueAt` | tidak | ISO 8601 dengan timezone eksplisit, atau `null`. |

Field milik server (`id`, `workspaceId`, `createdBy`, `createdAt`, `updatedAt`, `deletedAt`, `completedAt`, `status`) **ditolak dengan 422** bila dikirim client.

```bash
curl -X POST http://localhost:4000/api/v1/workspaces/$WORKSPACE_ID/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Belajar PostgreSQL",
    "description": "Indexing dan keyset pagination",
    "priority": "high",
    "dueAt": "2026-11-10T09:00:00+07:00"
  }'
```

Status awal selalu `todo`, `completedAt` selalu `null`, dan `createdAt`/`updatedAt` berasal dari server.

## 4. Listing dan filter

`GET /api/v1/workspaces/{workspaceId}/todos`

| Query | Tipe | Default | Keterangan |
| --- | --- | --- | --- |
| `limit` | integer 1–100 | `20` | Jumlah item per halaman. |
| `cursor` | string | — | `pagination.nextCursor` dari halaman sebelumnya. |
| `status` | enum | — | Filter satu status. |
| `priority` | enum | — | Filter satu priority. |
| `dueFrom` | ISO 8601 | — | Batas bawah `dueAt`, **inclusive**. |
| `dueTo` | ISO 8601 | — | Batas atas `dueAt`, **inclusive**. |
| `createdFrom` | ISO 8601 | — | Batas bawah `createdAt`, **inclusive**. |
| `createdTo` | ISO 8601 | — | Batas atas `createdAt`, **inclusive**. |
| `q` | string ≤ 200 | — | Pencarian case-insensitive pada title dan description. |

Semua filter digabung dengan `AND`. `dueFrom > dueTo` atau `createdFrom > createdTo` menghasilkan **422 `INVALID_DATE_RANGE`**.

```bash
curl "http://localhost:4000/api/v1/workspaces/$WORKSPACE_ID/todos?status=todo&priority=high&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Respons listing

```json
{
  "items": [],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null
  }
}
```

Urutan selalu `created_at DESC, id DESC`. Cursor bersifat opaque, terikat pada workspace dan filter, dan tidak boleh dimodifikasi client. Cursor yang rusak atau dipakai dengan filter/workspace berbeda menghasilkan **400 `INVALID_CURSOR`**.

Detail format cursor ada di [cursor-pagination.md](../features/cursor-pagination.md).

## 5. Detail, update, complete, delete

### Detail

`GET /api/v1/workspaces/{workspaceId}/todos/{todoId}`

Mengembalikan `200 { todo }` untuk todo aktif. Todo yang tidak ada, sudah dihapus, atau berada di workspace lain menghasilkan **404 `TODO_NOT_FOUND`**.

### Update

`PATCH /api/v1/workspaces/{workspaceId}/todos/{todoId}`

Minimal satu field harus dikirim:

```json
{
  "title": "Belajar advanced PostgreSQL",
  "description": null,
  "status": "in_progress",
  "priority": "urgent",
  "dueAt": "2026-11-12T09:00:00+07:00"
}
```

- `description: null` menghapus deskripsi.
- `dueAt: null` menghapus deadline.
- Mengubah status menjadi `completed` mengisi `completedAt` dengan waktu server.
- Mengubah status dari `completed` ke status lain mengosongkan `completedAt`.
- Body kosong menghasilkan **422 `VALIDATION_ERROR`**.

### Complete

`PATCH /api/v1/workspaces/{workspaceId}/todos/{todoId}/complete`

Mengubah status menjadi `completed` dan mengisi `completedAt`. Pemanggilan kedua bersifat idempoten: `completedAt` dan `updatedAt` tidak berubah.

### Delete

`DELETE /api/v1/workspaces/{workspaceId}/todos/{todoId}`

Selalu mengembalikan **204** selama user adalah member workspace, termasuk bila todo sudah terhapus atau tidak ada di workspace tersebut. Ini adalah konsekuensi desain idempoten dan anti-enumerasi. Delete tidak pernah menyentuh todo milik workspace lain.

## 6. Today view

`GET /api/v1/workspaces/{workspaceId}/todos/today`

| Query | Default | Keterangan |
| --- | --- | --- |
| `timezone` | `APP_DEFAULT_TIMEZONE` (`UTC`) | IANA timezone, mis. `Asia/Jakarta`. |
| `includeCompleted` | `false` | `true` menyertakan todo `completed`. |
| `limit` | `20` | 1–100. |
| `cursor` | — | Cursor halaman sebelumnya. |

Rentang: `[awal hari ini, awal hari besok)`. Todo `cancelled` selalu dikecualikan; todo `completed` hanya muncul bila `includeCompleted=true`. Today dihitung dari `dueAt`, bukan `createdAt`.

## 7. Upcoming view

`GET /api/v1/workspaces/{workspaceId}/todos/upcoming`

| Query | Default | Keterangan |
| --- | --- | --- |
| `timezone` | `APP_DEFAULT_TIMEZONE` | IANA timezone. |
| `days` | `7` | Bilangan bulat 1–30. |
| `limit` | `20` | 1–100. |
| `cursor` | — | Cursor halaman sebelumnya. |

Rentang: `[awal hari besok, awal hari (hari ini + days + 1))`. Todo tanpa `dueAt`, `completed`, dan `cancelled` dikecualikan.

## 8. Overdue view

`GET /api/v1/workspaces/{workspaceId}/todos/overdue`

| Query | Default | Keterangan |
| --- | --- | --- |
| `timezone` | `APP_DEFAULT_TIMEZONE` | IANA timezone. |
| `limit` | `20` | 1–100. |
| `cursor` | — | Cursor halaman sebelumnya. |

Todo dianggap overdue bila `dueAt < awal hari ini` dan status bukan `completed`/`cancelled`. Status **tidak diubah otomatis**; overdue hanya hasil perhitungan deadline.

## 9. Status HTTP dan error

| Status | Arti |
| --- | --- |
| `200` | Sukses membaca/mengubah. |
| `201` | Todo berhasil dibuat. |
| `204` | Delete berhasil atau idempoten. |
| `400` | Cursor tidak valid, atau body bukan JSON valid. |
| `401` | Token tidak ada/invalid/kedaluwarsa. |
| `404` | Todo/workspace tidak ditemukan atau tidak dapat diakses. |
| `422` | Validasi skema, status/priority, tanggal, timezone, range, atau limit. |
| `500` | Error internal tanpa detail sensitif. |

Contoh error:

```json
{
  "error": {
    "code": "INVALID_TIMEZONE",
    "message": "Timezone harus berupa identifier IANA yang valid.",
    "requestId": "req-123"
  }
}
```

Dokumentasi interaktif tersedia pada `/openapi` dan spesifikasi JSON pada `/openapi/json` dengan tag `Todo`.
