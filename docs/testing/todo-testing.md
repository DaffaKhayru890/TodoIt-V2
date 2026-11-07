# Pengujian Todo Module

Dokumen ini mencatat strategi dan **hasil nyata** pengujian Phase 3. Tidak ada klaim hasil untuk test yang belum dijalankan.

## 1. Perintah

```bash
# Typecheck seluruh project
bun run typecheck

# Seluruh test (PostgreSQL test harus siap)
bun test --env-file=.env.test

# Hanya unit test Todo
bun test --env-file=.env.test tests/unit/todo

# Integration endpoint Todo
bun test --env-file=.env.test tests/integration/todo-endpoints.test.ts

# Integration repository terhadap PostgreSQL nyata
bun test --env-file=.env.test tests/integration/todo-database.test.ts
```

Prasyarat integration test:

1. Container PostgreSQL berjalan (`todo-postgres`).
2. Database `todo_test` ada.
3. Migration `0000` dan `0001` sudah diterapkan:

```bash
bun db:migrate:test
```

## 2. Hasil eksekusi terakhir

| Cakupan | File | Test | Hasil |
| --- | --- | --- | --- |
| Todo unit | 7 file | 111 | 111 pass |
| Todo endpoint integration | 1 file | 19 | 19 pass |
| Todo PostgreSQL integration | 1 file | 8 | 8 pass |
| **Total test Todo** | **9 file** | **138** | **138 pass** |
| **Regresi seluruh project** | **33 file** | **263** | **263 pass** |

`bun run typecheck` selesai tanpa error.

Rincian unit test:

| File | Jumlah | Fokus |
| --- | --- | --- |
| `domain.test.ts` | 24 | Invariant entity, status transition, completedAt, soft delete. |
| `date-range.test.ts` | 11 | Today/Upcoming/Overdue, timezone, DST, validasi `days`. |
| `cursor-encoder.test.ts` | 9 | Encode/decode, filter fingerprint, cursor rusak. |
| `use-cases.test.ts` | 27 | CRUD, otorisasi, idempotensi, 404 anti-enumerasi. |
| `pagination-filtering.test.ts` | 19 | Keyset, deduplikasi, filter, pencarian, limit. |
| `views.test.ts` | 16 | Today/Upcoming/Overdue dan batas waktu. |
| `openapi.test.ts` | 5 | Path, metadata operasi, query parameter, error schema. |

## 3. Matriks cakupan

### Domain dan application

- Judul kosong, judul terlalu panjang, deskripsi terlalu panjang.
- Trim judul/deskripsi dan normalisasi string kosong.
- Status/priority valid dan tidak valid.
- `completedAt` selalu konsisten dengan status.
- Complete idempoten tidak menggeser timestamp.
- Soft delete idempoten.
- Update ditolak untuk entity terhapus.
- Metadata server tidak dapat ditimpa client.
- Otorisasi: member, non-member, workspace arsip.
- 404 untuk todo tidak ada/terhapus/workspace lain.

### Endpoint

- `401` tanpa access token.
- `404` untuk workspace yang tidak dapat diakses.
- Create → list → detail → update → complete → delete.
- Penolakan metadata internal dan `dueAt` tanpa timezone.
- Update tanpa field.
- Limit di atas 100 dan cursor rusak.
- Cross-workspace GET/PATCH tidak membocorkan data.
- Delete cross-workspace tetap 204 dan tidak mengubah data workspace lain.
- Pagination Today/Upcoming/Overdue.
- Timezone dan `includeCompleted`.
- OpenAPI mendokumentasikan seluruh endpoint dan query parameter.

### PostgreSQL

- Insert, find, update, soft delete.
- Baris terhapus tidak ditemukan lagi.
- Update menolak baris terhapus dan workspace lain.
- Constraint status, priority, panjang judul, `completedAt`, timestamp.
- Index Phase 3 ada.
- Query keyset dan filter mengembalikan hasil yang benar.
- `deleted_at` benar-benar tersimpan di database.

## 4. Fixture dan helper

| Helper | Kegunaan |
| --- | --- |
| `tests/helpers/todo-fixtures.ts` | Use case nyata + in-memory repository + `FixedClock`. |
| `tests/helpers/in-memory-todo-repository.ts` | Implementasi kontrak repository untuk unit test, termasuk urutan dan keyset. |
| `tests/helpers/todo-test-app.ts` | Aplikasi Elysia lengkap dengan auth guard, in-memory Auth/Workspace, dan Todo repository. |

`FixedClock` membuat waktu deterministik. Test yang membutuhkan urutan `created_at` memajukan clock secara eksplisit; test tie-breaker sengaja membiarkan `createdAt` sama dan memverifikasi `id DESC`.

## 5. Integration database

`tests/integration/todo-database.test.ts` memakai PostgreSQL nyata, bukan mock. Test membuat user/workspace unik per kasus dan membersihkan data setelahnya. Yang diperiksa antara lain:

- Foreign key dan cascade workspace.
- Check constraint `todos_status_check`, `todos_priority_check`, `todos_title_length_check`, `todos_completed_at_check`, `todos_timestamp_order_check`.
- Keberadaan lima index Phase 3.
- Perilaku partial index melalui hasil query aktif.
- Soft delete dan idempotensi.

## 6. Catatan

- Test tidak memakai `OFFSET` dan tidak mengandalkan urutan baris database tanpa `ORDER BY`.
- Test endpoint memakai `app.handle(new Request(...))`, tanpa membuka port.
- Test tidak menyentuh database development.
- Angka pada dokumen ini berasal dari eksekusi setelah seluruh perbaikan Phase 3; jalankan ulang perintah di atas bila ingin memverifikasi.
