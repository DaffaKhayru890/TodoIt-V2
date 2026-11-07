# Today View

Today View menampilkan todo yang deadline-nya berada pada **hari ini** menurut timezone pengguna.

```text
GET /api/v1/workspaces/{workspaceId}/todos/today
```

## 1. Definisi

```text
dueAt ∈ [awal hari ini, awal hari besok)
```

Perhitungan dilakukan per request memakai IANA timezone. Default timezone berasal dari `APP_DEFAULT_TIMEZONE` (`UTC`).

Karena memakai `dueAt`, todo tanpa deadline **tidak** muncul di Today, walaupun dibuat hari ini. `createdAt` tidak dipakai untuk view ini.

## 2. Status yang ditampilkan

| Status | Default | `includeCompleted=true` |
| --- | --- | --- |
| `todo` | ya | ya |
| `in_progress` | ya | ya |
| `completed` | tidak | ya |
| `cancelled` | tidak | tidak |

Todo `cancelled` selalu dikecualikan. Todo `completed` hanya muncul bila client secara eksplisit mengirim `includeCompleted=true`.

## 3. Query parameter

| Parameter | Default | Aturan |
| --- | --- | --- |
| `timezone` | `APP_DEFAULT_TIMEZONE` | IANA timezone, mis. `Asia/Jakarta`. |
| `includeCompleted` | `false` | Boolean string: `true`/`false`. |
| `limit` | `20` | Integer 1–100. |
| `cursor` | — | Cursor dari respons sebelumnya. |

## 4. Contoh

Request:

```bash
curl "http://localhost:4000/api/v1/workspaces/$WORKSPACE_ID/todos/today?timezone=Asia/Jakarta&includeCompleted=true" \
  -H "Authorization: Bearer $TOKEN"
```

Respons:

```json
{
  "items": [
    {
      "id": "0f7e0d3a-4d3c-4f6e-9a7e-1a2b3c4d5e6f",
      "title": "Deadline hari ini",
      "status": "todo",
      "priority": "high",
      "dueAt": "2026-11-07T09:00:00.000Z",
      "completedAt": null,
      "createdAt": "2026-11-06T02:00:00.000Z",
      "updatedAt": "2026-11-06T02:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": false,
    "nextCursor": null
  }
}
```

## 5. Contoh batas hari

Dengan `now = 2026-11-07T10:00:00Z`:

| Timezone | Awal hari | Awal besok | `2026-11-06T18:00:00Z` |
| --- | --- | --- | --- |
| `UTC` | `2026-11-07T00:00:00Z` | `2026-11-08T00:00:00Z` | bukan Today |
| `Asia/Jakarta` | `2026-11-06T17:00:00Z` | `2026-11-07T17:00:00Z` | Today (01:00 WIB) |

## 6. Pagination dan filter

Today memakai mekanisme cursor yang sama dengan listing:

- Urutan `created_at DESC, id DESC`.
- `limit + 1` untuk menentukan `hasMore`.
- Cursor terikat pada workspace, view `today`, timezone, dan `includeCompleted`.
- Memakai cursor dari listing biasa atau timezone lain menghasilkan **400 `INVALID_CURSOR`**.
- Filter `q`, `status`, `priority`, dan rentang tanggal tidak tersedia di endpoint ini.

## 7. Error

| Kondisi | HTTP | Code |
| --- | --- | --- |
| Timezone tidak valid | 422 | `INVALID_TIMEZONE` |
| Limit di luar 1–100 | 422 | `VALIDATION_ERROR` |
| Cursor rusak/tidak cocok | 400 | `INVALID_CURSOR` |
| Bukan member workspace | 404 | `WORKSPACE_ACCESS_DENIED` |

Today tidak mengubah status todo dan tidak memicu efek samping apa pun.
