# Upcoming View

Upcoming View menampilkan todo yang deadline-nya berada dalam sejumlah hari kalender ke depan, tidak termasuk hari ini.

```text
GET /api/v1/workspaces/{workspaceId}/todos/upcoming
```

## 1. Definisi rentang

```text
dueAt ∈ [awal hari besok, awal hari (hari ini + days + 1))
```

Dengan `days = 7` (default), rentangnya adalah **7 hari kalender setelah hari ini**: besok sampai hari ke-7. Hari ini dan hari ke-8 tidak termasuk.

Contoh dengan `now = 2026-11-07T10:00:00Z`, timezone `UTC`, `days = 7`:

```text
start = 2026-11-08T00:00:00Z
end   = 2026-11-15T00:00:00Z
```

| `dueAt` | Masuk? |
| --- | --- |
| `2026-11-07T09:00:00Z` (hari ini) | tidak |
| `2026-11-08T00:00:00Z` (besok) | ya |
| `2026-11-14T23:59:59.999Z` (hari ke-7) | ya |
| `2026-11-15T00:00:00Z` (hari ke-8) | tidak |

## 2. Status dan deadline

Todo yang ditampilkan harus:

- Berada di workspace yang dapat diakses user.
- Belum soft-deleted.
- Memiliki `dueAt`.
- Berstatus selain `completed` dan `cancelled`.

Tidak ada parameter `includeCompleted` pada Upcoming. Todo tanpa deadline tidak pernah muncul.

## 3. Query parameter

| Parameter | Default | Aturan |
| --- | --- | --- |
| `timezone` | `APP_DEFAULT_TIMEZONE` | IANA timezone. |
| `days` | `7` | Bilangan bulat 1–30. |
| `limit` | `20` | Integer 1–100. |
| `cursor` | — | Cursor dari respons sebelumnya. |

`days` di luar 1–30 atau bukan bilangan bulat menghasilkan **422 `INVALID_UPCOMING_RANGE`**.

## 4. Contoh

```bash
curl "http://localhost:4000/api/v1/workspaces/$WORKSPACE_ID/todos/upcoming?timezone=Asia/Jakarta&days=14&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

Respons memakai bentuk yang sama dengan listing:

```json
{
  "items": [],
  "pagination": {
    "limit": 50,
    "hasMore": false,
    "nextCursor": null
  }
}
```

## 5. Pagination

- Urutan `created_at DESC, id DESC`.
- `limit + 1` untuk `hasMore`.
- Cursor terikat pada workspace, view `upcoming`, timezone, dan nilai `days`.
- Mengubah `days` atau `timezone` di tengah pagination membuat cursor lama ditolak dengan **400 `INVALID_CURSOR`**.

## 6. DST dan batas hari

Rentang dihitung pada kalender lokal, bukan dengan menambahkan 24 jam UTC. Pada hari pergantian DST, jumlah jam dalam satu hari bisa 23 atau 25 jam, tetapi batas `[awal hari, awal hari berikutnya)` tetap benar. Detail ada di [todo-date-management.md](todo-date-management.md).

## 7. Error

| Kondisi | HTTP | Code |
| --- | --- | --- |
| Timezone tidak valid | 422 | `INVALID_TIMEZONE` |
| `days` di luar 1–30 | 422 | `INVALID_UPCOMING_RANGE` |
| Limit di luar 1–100 | 422 | `VALIDATION_ERROR` |
| Cursor rusak/tidak cocok | 400 | `INVALID_CURSOR` |
| Bukan member workspace | 404 | `WORKSPACE_ACCESS_DENIED` |
