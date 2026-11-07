# API Tag

Base path:

```text
/api/v1/workspaces/{workspaceId}/tags
```

Semua endpoint membutuhkan `Authorization: Bearer <access_token>`.

Bentuk sukses satu tag:

```json
{
  "tag": {
    "id": "uuid",
    "workspaceId": "uuid",
    "name": "Backend",
    "createdAt": "2026-11-07T05:00:00.000Z",
    "updatedAt": "2026-11-07T05:00:00.000Z"
  }
}
```

`normalizedName` tidak dikirim. Listing memakai `{ items, pagination }` dengan `limit` default 20, maksimum 100, diurutkan `created_at DESC, id DESC`. Query `q` mencari nama secara case-insensitive di database.

| Method | Path | Peran | Sukses |
| --- | --- | --- | --- |
| `POST` | `/tags` | owner, admin | 201 |
| `GET` | `/tags` | member | 200 |
| `GET` | `/tags/{tagId}` | member | 200 |
| `PATCH` | `/tags/{tagId}` | owner, admin | 200 |
| `DELETE` | `/tags/{tagId}` | owner, admin | 204 |
| `PUT` | `/todos/{todoId}/tags` | member | 200 `{ tags }` |
| `POST` | `/todos/{todoId}/tags/{tagId}` | member | 200 `{ tags }` |
| `DELETE` | `/todos/{todoId}/tags/{tagId}` | member | 200 `{ tags }` |

`PUT` mengganti seluruh association. `tagIds: []` menghapus semua tag. ID duplikat dinormalisasi dengan mempertahankan urutan kemunculan pertama. Lebih dari 20 tag menghasilkan **422 `TAG_LIMIT_EXCEEDED`**. Tag workspace lain menghasilkan **404 `TAG_WORKSPACE_MISMATCH`**.

`POST` dan `DELETE` assignment bersifat idempoten.

| Kondisi | HTTP | Kode |
| --- | --- | --- |
| Tanpa token | 401 | `UNAUTHORIZED` |
| Bukan member | 404 | `WORKSPACE_ACCESS_DENIED` |
| Member mengelola katalog | 403 | `WORKSPACE_PERMISSION_DENIED` |
| Nama duplikat | 409 | `TAG_ALREADY_EXISTS` |
| Nama kosong setelah trim | 422 | `TAG_NAME_REQUIRED` atau `VALIDATION_ERROR` |
| Tag tidak ada | 404 | `TAG_NOT_FOUND` |

Dokumentasi interaktif: `GET /openapi`. Spesifikasi JSON: `GET /openapi/json`.
