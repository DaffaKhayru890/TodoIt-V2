# Filtering dan Pencarian Todo

Endpoint listing `GET /api/v1/workspaces/{workspaceId}/todos` mendukung kombinasi filter. Semua filter memakai `AND`; tidak ada OR antar filter.

## 1. Daftar filter

| Parameter | Nilai | Semantik |
| --- | --- | --- |
| `status` | `todo`, `in_progress`, `completed`, `cancelled` | Status harus sama persis. |
| `priority` | `low`, `medium`, `high`, `urgent` | Priority harus sama persis. |
| `dueFrom` | ISO 8601 + timezone | `dueAt >= dueFrom`. |
| `dueTo` | ISO 8601 + timezone | `dueAt <= dueTo`. |
| `createdFrom` | ISO 8601 + timezone | `createdAt >= createdFrom`. |
| `createdTo` | ISO 8601 + timezone | `createdAt <= createdTo`. |
| `q` | string ≤ 200 | Cari substring pada title/description. |

Batas `dueFrom`/`dueTo` dan `createdFrom`/`createdTo` bersifat **inclusive**. Todo tanpa `dueAt` otomatis tidak lolos filter `dueFrom`/`dueTo`.

## 2. Contoh kombinasi

```bash
curl "http://localhost:4000/api/v1/workspaces/$WORKSPACE_ID/todos?status=todo&priority=high&dueFrom=2026-11-01T00:00:00Z&dueTo=2026-11-30T23:59:59Z&q=laporan" \
  -H "Authorization: Bearer $TOKEN"
```

Query di atas berarti:

```text
workspace cocok
AND deleted_at IS NULL
AND status = 'todo'
AND priority = 'high'
AND due_at >= '2026-11-01T00:00:00Z'
AND due_at <= '2026-11-30T23:59:59Z'
AND (title ILIKE '%laporan%' OR description ILIKE '%laporan%')
ORDER BY created_at DESC, id DESC
```

## 3. Pencarian `q`

- Case-insensitive (PostgreSQL `ILIKE`).
- Mencari substring pada `title` **atau** `description`.
- Spasi di awal/akhir di-trim; string kosong diabaikan.
- Maksimal 200 karakter; lebih dari itu menghasilkan **422 `VALIDATION_ERROR`**.
- Karakter `%`, `_`, dan `\` di-escape sehingga diperlakukan literal, bukan wildcard SQL.

Contoh: `q=50%` mencari teks yang benar-benar mengandung `50%`, bukan “50 diikuti apa pun”.

Pencarian **tidak** memakai index trigram pada Phase 3. Untuk workspace kecil, PostgreSQL memakai index workspace lalu memfilter baris. Bila volume teks tumbuh besar, pertimbangkan `pg_trgm` pada fase optimasi berikutnya. Detail ada di [todo-query-optimization.md](../performance/todo-query-optimization.md).

## 4. Validasi

| Kondisi | HTTP | Code |
| --- | --- | --- |
| Status tidak dikenal | 422 | `TODO_STATUS_INVALID` |
| Priority tidak dikenal | 422 | `TODO_PRIORITY_INVALID` |
| Format tanggal salah / tanpa timezone | 422 | `INVALID_DATE_RANGE` |
| `dueFrom > dueTo` | 422 | `INVALID_DATE_RANGE` |
| `createdFrom > createdTo` | 422 | `INVALID_DATE_RANGE` |
| `q` > 200 karakter | 422 | `VALIDATION_ERROR` |
| Limit di luar 1–100 | 422 | `VALIDATION_ERROR` |

## 5. Hubungan dengan cursor

Cursor menyimpan fingerprint dari seluruh filter yang sudah dinormalisasi. Artinya:

- Menambah/menghapus filter di tengah pagination membuat cursor lama ditolak.
- Urutan penulisan query string tidak memengaruhi fingerprint.
- Nilai yang sama tetapi ditulis dengan offset timezone berbeda (mis. `02:00Z` dan `09:00+07:00`) menghasilkan instant yang sama, sehingga fingerprint sama.

Detail: [cursor-pagination.md](cursor-pagination.md).

## 6. Yang tidak tersedia

Phase 3 belum mendukung:

- Pencarian berdasarkan `createdBy`.
- Filter tag/label.
- Filter “overdue” di endpoint listing biasa (gunakan `/overdue`).
- Pengurutan berdasarkan priority/due date.
- Filter multi-nilai (`status=todo,cancelled`).

## Metadata (Phase 4)

Listing, Today, Upcoming, dan Overdue juga menerima `tagIds` (semantics ANY) dan `labelId`. Detailnya ada di [todo-metadata-integration.md](todo-metadata-integration.md).
