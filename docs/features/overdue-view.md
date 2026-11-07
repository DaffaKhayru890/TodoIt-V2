# Overdue View

Overdue View menampilkan todo yang deadline-nya sudah lewat sebelum awal hari ini.

```text
GET /api/v1/workspaces/{workspaceId}/todos/overdue
```

## 1. Definisi

```text
dueAt < awal hari ini (menurut timezone request)
```

Todo yang deadline-nya tepat pada awal hari ini **belum** overdue; ia masuk Today. Todo yang deadline-nya kemarin 23:59:59.999 sudah overdue.

Status yang dikecualikan:

- `completed` — sudah selesai, bukan keterlambatan aktif.
- `cancelled` — dibatalkan.
- Todo tanpa `dueAt`.
- Todo yang sudah soft-deleted.

Status `todo` dan `in_progress` dapat menjadi overdue.

## 2. Overdue tidak mengubah status

View ini hanya membaca data. Tidak ada:

- Perubahan status otomatis.
- Penulisan `overdueAt`.
- Background job atau scheduler.
- Notifikasi.

Dengan demikian, todo yang sudah lewat deadline tetap berstatus `todo` atau `in_progress` sampai client mengubahnya.

## 3. Timezone

Batas hari bergantung pada timezone:

```text
now = 2026-11-07T10:00:00Z
```

| Timezone | Awal hari ini | `dueAt = 2026-11-06T18:00:00Z` |
| --- | --- | --- |
| `UTC` | `2026-11-07T00:00:00Z` | overdue (18:00 kemarin UTC) |
| `Asia/Jakarta` | `2026-11-06T17:00:00Z` | belum overdue (01:00 hari ini WIB) |

Ini alasan endpoint menerima `timezone` dan tidak mengandalkan timezone server.

## 4. Query parameter

| Parameter | Default | Aturan |
| --- | --- | --- |
| `timezone` | `APP_DEFAULT_TIMEZONE` | IANA timezone. |
| `limit` | `20` | Integer 1–100. |
| `cursor` | — | Cursor dari respons sebelumnya. |

Tidak ada parameter `days` atau `includeCompleted`.

## 5. Contoh

```bash
curl "http://localhost:4000/api/v1/workspaces/$WORKSPACE_ID/todos/overdue?timezone=Asia/Jakarta" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "items": [
    {
      "id": "0f7e0d3a-4d3c-4f6e-9a7e-1a2b3c4d5e6f",
      "title": "Laporan mingguan",
      "status": "in_progress",
      "priority": "urgent",
      "dueAt": "2026-11-05T09:00:00.000Z",
      "completedAt": null,
      "createdAt": "2026-11-01T02:00:00.000Z",
      "updatedAt": "2026-11-05T03:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null
  }
}
```

## 6. Pagination

- Urutan `created_at DESC, id DESC`.
- Cursor terikat pada workspace, view `overdue`, dan timezone.
- `limit + 1` menentukan `hasMore`.
- Cursor dari view/filter lain ditolak dengan **400 `INVALID_CURSOR`**.

## 7. Error

| Kondisi | HTTP | Code |
| --- | --- | --- |
| Timezone tidak valid | 422 | `INVALID_TIMEZONE` |
| Limit di luar 1–100 | 422 | `VALIDATION_ERROR` |
| Cursor rusak/tidak cocok | 400 | `INVALID_CURSOR` |
| Bukan member workspace | 404 | `WORKSPACE_ACCESS_DENIED` |
