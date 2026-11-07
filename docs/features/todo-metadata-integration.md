# Integrasi Metadata pada Todo

Response Todo yang sudah ada diperluas, bukan diganti. Setiap detail dan item listing memuat:

```json
"label": { "id": "uuid", "name": "Work", "color": "#2ECC71" },
"tags": [{ "id": "uuid", "name": "Backend" }]
```

Tanpa label, `label` adalah `null`. Tanpa tag, `tags` adalah `[]`. Password dan kolom internal tidak ikut.

## Pemuatan

Listing:

1. Ambil satu halaman Todo dengan keyset `created_at DESC, id DESC` dan `LIMIT limit + 1`.
2. Filter tag memakai `EXISTS`, bukan join, supaya Todo yang punya banyak tag tidak terduplikasi sebelum limit dihitung.
3. Setelah halaman terbentuk, `TodoMetadataService` memuat label untuk kumpulan `labelId` dan tag untuk kumpulan `todoId`, masing-masing satu query.

## Filter

`GET /todos`, `/todos/today`, `/todos/upcoming`, dan `/todos/overdue` menerima:

- `tagIds`: boleh diulang. Semantics **ANY** — Todo tampil bila memiliki salah satu tag.
- `labelId`: Todo harus memakai label itu.

Keduanya dapat digabung. Filter tetap di SQL, bukan di memori setelah seluruh tabel dimuat.

## Fingerprint cursor

Hash mencakup kind view, status, priority, rentang due/created, search, status yang dikecualikan, `tagIds` yang sudah diurutkan, `labelId`, timezone, `includeCompleted`, dan `days`.

Cursor dari filter lain, view lain, atau deployment sebelum `tagIds`/`labelId` masuk ke hash ditolak dengan **400 `INVALID_CURSOR`**. Client mengulang dari halaman pertama. Cursor tetap opaque Base64URL versi 1.
