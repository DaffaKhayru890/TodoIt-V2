# Priority Todo

Priority menyatakan tingkat kepentingan todo. Phase 3 menyimpan priority sebagai nilai enum dan mendukung filter, tetapi **tidak** mengurutkan listing berdasarkan priority.

## 1. Nilai yang valid

| Nilai | Arti umum |
| --- | --- |
| `low` | Prioritas rendah; default bila tidak diisi. |
| `medium` | Prioritas sedang. |
| `high` | Prioritas tinggi. |
| `urgent` | Perlu segera ditangani. |

Urutan di atas adalah urutan dokumentasi, bukan urutan pengurutan query. Listing tetap memakai `created_at DESC, id DESC`.

## 2. Create

```json
{
  "title": "Siapkan laporan",
  "priority": "high"
}
```

- Jika `priority` tidak dikirim, nilainya `low`.
- Jika dikirim, nilainya harus salah satu dari empat enum.
- Nilai lain menghasilkan **422 `TODO_PRIORITY_INVALID`**.
- Schema juga membatasi enum sehingga nilai asing dapat ditolak sebagai validation error.

## 3. Update

```json
{
  "priority": "urgent"
}
```

Priority dapat diubah kapan saja selama todo aktif. Update priority tidak mengubah `completedAt` dan tidak mengubah status.

## 4. Filter

`GET /todos?priority=high`

Filter hanya menerima satu priority. Kombinasi dengan filter lain memakai `AND`:

```text
GET /todos?priority=high&status=todo&dueTo=2026-11-30T23:59:59Z
```

Tidak ada filter “priority minimal” atau pengurutan priority pada Phase 3.

## 5. Index

Filter priority memakai partial index:

```text
todos_workspace_priority_created_at_id_idx
(workspace_id, priority, created_at DESC, id DESC)
WHERE deleted_at IS NULL
```

Index ini menjaga filter priority tetap selektif sekaligus mempertahankan urutan keyset. Detail hasil pengukuran ada di [todo-query-optimization.md](../performance/todo-query-optimization.md).

## 6. Batasan Phase 3

- Tidak ada bobot numerik priority.
- Tidak ada pengurutan `ORDER BY priority`.
- Tidak ada aturan otomatis yang mengubah priority berdasarkan deadline.
- Priority tidak memengaruhi status atau overdue.

Pengurutan priority, misalnya `urgent` lebih dulu, memerlukan perubahan kontrak pagination dan index; itu bukan bagian Phase 3.
