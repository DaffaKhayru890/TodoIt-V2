# Pengujian Metadata dan Reminder

Jalankan seluruh suite dari root proyek:

```bash
bun test --env-file=.env.test
bun run typecheck
```

Test integrasi database memakai PostgreSQL pada `DATABASE_*` di `.env.test`. Test HTTP metadata memakai `app.handle()` dengan repository in-memory, pola yang sama dengan endpoint Todo Phase 3. Reminder memakai `FixedClock` (`2026-11-07T10:00:00.000Z` pada helper HTTP). Tidak ada sleep yang menunggu waktu dunia nyata, kecuali penahanan lock 200 ms pada tes konkurensi transaksi.

## Cakupan

| Berkas | Yang diuji |
| --- | --- |
| `tests/unit/todo/metadata-domain.test.ts` | Normalisasi nama, warna HEX, entity Tag/Label/Reminder, offset, cancel, effective time. |
| `tests/unit/todo/metadata-use-cases.test.ts` | CRUD Tag/Label, izin owner/admin/member, assignment, filter ANY, fingerprint, batch load. |
| `tests/unit/todo/reminder-use-cases.test.ts` | Create/update/cancel, duplikat, todo tidak layak, dueAt, urutan effectiveAt, lifecycle. |
| `tests/unit/todo/openapi.test.ts` | Path Tag, Label, Reminder, serta `tagIds`/`labelId` pada dokumentasi Todo. |
| `tests/integration/todo-metadata-endpoints.test.ts` | HTTP sukses, 401, 403, 404, 409, 422 untuk tag, label, reminder, dan filter view. |
| `tests/integration/todo-metadata-database.test.ts` | Unique, cascade, SET NULL, check constraint, cross-workspace, create konkuren, lock dueAt. |

Repository unit memakai implementasi in-memory yang meniru unique name, cascade tag, dan `ON DELETE SET NULL`.

Hasil suite lengkap pada penyelesaian Phase 4:

- 346 test lulus
- 0 gagal
- 0 dilewati
- 1.227 assertion
- 38 file
- typecheck `tsc --noEmit` berhasil

Coverage tidak diukur pada sesi ini.
