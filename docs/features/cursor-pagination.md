# Cursor Pagination

Semua endpoint listing Todo memakai **keyset pagination**, bukan `OFFSET`. Tujuannya agar halaman tetap stabil ketika data baru masuk dan biaya query tidak bertambah seiring kedalaman halaman.

## 1. Urutan

```sql
ORDER BY created_at DESC, id DESC
```

`created_at` adalah kunci utama; `id` adalah tie-breaker ketika dua todo memiliki instant yang sama. Tanpa tie-breaker, urutan bisa berubah antar query dan menyebabkan item terlewat/duplikat.

## 2. Parameter

| Parameter | Default | Maksimum |
| --- | --- | --- |
| `limit` | `20` | `100` |
| `cursor` | — | 2.048 karakter |

`limit` harus bilangan bulat 1–100. Nilai lain menghasilkan **422 `VALIDATION_ERROR`**.

## 3. Algoritma halaman

1. Decode dan validasi cursor (jika ada).
2. Query `WHERE ... AND keyset_condition ORDER BY created_at DESC, id DESC LIMIT limit + 1`.
3. Jika hasil > `limit`, `hasMore = true` dan item terakhir halaman menjadi posisi cursor berikutnya.
4. Item yang dikembalikan hanya `limit` buah.
5. Encode cursor baru dari `(createdAt, id)` item terakhir.

```text
keyset_condition:
  created_at < cursor.createdAt
  OR (created_at = cursor.createdAt AND id < cursor.id)
```

Karena urutannya `DESC`, “halaman berikutnya” berarti pasangan yang lebih kecil dari cursor.

## 4. Bentuk respons

```json
{
  "items": [],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJ2ZXJzaW9uIjoxLCJ3b3Jrc3BhY2VJZCI6..."
  }
}
```

- `hasMore` dihitung dari `limit + 1`, bukan dari jumlah item.
- `nextCursor` bernilai `null` pada halaman terakhir.
- Cursor **opaque**: client tidak boleh mengurai, mengubah, atau membuatnya sendiri.

## 5. Format cursor

Payload sebelum encoding:

```json
{
  "version": 1,
  "workspaceId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "createdAt": "2026-11-07T10:00:00.000Z",
  "id": "0f7e0d3a-4d3c-4f6e-9a7e-1a2b3c4d5e6f",
  "filterHash": "sha256-hex"
}
```

Payload diserialisasi JSON lalu di-encode **Base64 URL-safe** (`A-Z`, `a-z`, `0-9`, `-`, `_`).

Validasi decode:

- Panjang 1–2.048 karakter.
- Hanya karakter Base64 URL-safe.
- JSON valid dan berupa object.
- `version` sama dengan versi yang didukung.
- `workspaceId` sama dengan workspace pada path.
- `createdAt` adalah ISO string yang valid dan round-trip.
- `id` adalah UUID.
- `filterHash` sama dengan fingerprint request saat ini.

Kegagalan salah satu pemeriksaan menghasilkan **400 `INVALID_CURSOR`**.

## 6. Fingerprint filter

Fingerprint dibuat dari representasi deterministik:

```text
SHA-256(stableStringify({
  kind,
  status,
  priority,
  dueAtFrom,
  dueAtTo,
  dueAtBefore,
  createdFrom,
  createdTo,
  search,
  excludedStatuses,
  tagIds,
  labelId,
  timezone,
  includeCompleted,
  days
}))
```

`stableStringify` mengurutkan key object, sehingga urutan properti tidak memengaruhi hash. Array `excludedStatuses` dan `tagIds` diurutkan sebelum di-hash. `tagIds` yang tidak dikirim menjadi array kosong; `labelId` yang tidak dikirim menjadi `null`.

Phase 4 menambahkan `tagIds` dan `labelId` ke payload fingerprint tanpa menaikkan `version` cursor. Cursor yang dibuat sebelum deployment ini tidak lagi cocok dan ditolak dengan **400 `INVALID_CURSOR`**. Client harus memulai ulang dari halaman pertama.

Konsekuensi:

- Cursor listing tidak dapat dipakai di `/today`, `/upcoming`, atau `/overdue`.
- Cursor Today dengan `includeCompleted=false` tidak dapat dipakai dengan `true`.
- Cursor Upcoming dengan `days=7` tidak dapat dipakai dengan `days=14`.
- Cursor satu workspace tidak dapat dipakai di workspace lain.

Semua kasus tersebut menghasilkan **400 `INVALID_CURSOR`**, bukan hasil yang salah diam-diam.

## 7. Data baru selama scrolling

Keyset pagination tidak memakai offset, sehingga:

- Todo baru yang `created_at`-nya lebih besar dari cursor tidak akan muncul di halaman berikutnya.
- Item lama tidak bergeser karena penambahan data baru.
- Tidak ada duplikasi antar halaman.

Ini berbeda dari `OFFSET`, di mana satu insert di awal dapat membuat item yang sama muncul dua kali.

## 8. Keterbatasan

- Tidak ada “previous page” pada Phase 3; client menyimpan cursor halaman sebelumnya bila perlu.
- Tidak ada total count, karena menghitung total pada setiap request mahal dan tidak diperlukan untuk UI.
- Cursor tidak dienkripsi; isinya dapat dibaca, tetapi tidak dapat dipalsukan tanpa fingerprint yang cocok. Jangan menaruh data sensitif di cursor.
- Perubahan filter setelah halaman pertama mengharuskan client memulai dari halaman pertama.
