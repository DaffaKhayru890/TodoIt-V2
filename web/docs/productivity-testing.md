# Testing productivity features

Phase 5 menambahkan pengujian untuk seluruh komponen, API service, hook, schema, utility tanggal, filter, sorting, dan alur integrasi. Semua API dimock dengan MSW; tidak ada test yang memanggil backend produksi.

## Hasil akhir

| Metrik     | Hasil  |
| ---------- | ------ |
| File test  | 96     |
| Test       | 523    |
| Lulus      | 523    |
| Gagal      | 0      |
| Skipped    | 0      |
| Statements | 91,80% |
| Branches   | 87,67% |
| Functions  | 92,74% |
| Lines      | 91,65% |

Perintah:

```bash
cd web
bun run test:run
bun run test:coverage
```

## Tag

- `models/tag.models.test.ts` — mapping DTO ke domain, tanggal, guard bentuk respons.
- `api/tag.api.test.ts` — list/create/update/delete, pagination, error.
- `hooks/tag-hooks.test.tsx` — query dan mutation, invalidasi cache workspace, isolasi workspace.
- `schemas/tag.schema.test.ts` — nama wajib, batas 50 karakter, trim.
- `TagBadge.test.tsx` — nama tag dirender sebagai teks.
- `TagSelector.test.tsx` — pilih/lepas, selected state, loading, error, empty.
- `TagDialog.test.tsx` (8 test) — create/edit, validasi, error API.
- `DeleteTagDialog.test.tsx` (4 test) — konfirmasi, cancel, error.
- `TagsPage.test.tsx` (7 test) — daftar, create, edit, delete, empty, error, permission owner/admin.

## Label

- `models/label.models.test.ts` — mapping, guard warna/deskripsi.
- `api/label.api.test.ts` — CRUD, assign, clear, error.
- `hooks/label-hooks.test.tsx` — query/mutation dan invalidasi cache.
- `schemas/label.schema.test.ts` — nama, warna `#RRGGBB`, deskripsi maksimal 300.
- `LabelBadge.test.tsx` — nama + warna, teks tetap ada.
- `LabelSelector.test.tsx` — pilih satu label, clear, loading/error/empty.
- `LabelDialog.test.tsx` (9 test) — create/edit, preset warna, deskripsi.
- `DeleteLabelDialog.test.tsx` (4 test).
- `LabelsPage.test.tsx` (7 test).

## Priority

- `models/todo-priority.test.ts` — konfigurasi empat level, label, bobot, fallback aman.
- `PriorityBadge.test.tsx` — teks label dan variant.
- `PrioritySelector.test.tsx` — nilai awal, perubahan, disabled, error.
- `sort-todos.test.ts` — ascending/descending berdasarkan bobot.
- `todo.api.test.ts` / `todo.mapper.test.ts` — priority dikirim dan dipetakan, nilai tidak dikenal ditolak.

## Tanggal dan timezone

- `utils/date-format.test.ts` — parsing `datetime-local`, round-trip kalender, format tanggal/jam, nilai input.
- `utils/due-date.test.ts` — status none/upcoming/today/overdue/completed, awal/akhir hari lokal, rentang today/tomorrow/next-7-days/overdue/custom, grouping, `isTodoOverdue`.
- `DueDateField.test.tsx` — input, clear, shortcut dengan `now` injeksi, preview, error.
- `TodoMetadata.test.tsx` — badge due date dan overdue.
- `TodayPage.test.tsx` (5 test) — skeleton, empty, aktif+selesai, complete, error+retry.
- `UpcomingPage.test.tsx` (4 test) — skeleton, empty, grouping dan pengecualian tanpa tenggat, error+retry.

Test tanggal memakai `Date` lokal yang dibangun dari komponen tahun/bulan/hari, bukan string tanpa timezone, sehingga tidak bergantung pada zona waktu mesin CI secara tidak sengaja.

## Reminder

- `models/reminder.models.test.ts` — mapping, guard, format offset.
- `api/reminder.api.test.ts` — list/create/update/cancel, parameter, error.
- `hooks/reminder-hooks.test.tsx` — query per todo, create/update/cancel, invalidasi.
- `ReminderSelector.test.tsx` — enable/disable, preset offset, disabled tanpa due date, error, ringkasan.

Test reminder tidak mengklaim pengiriman notifikasi. Yang diuji adalah konfigurasi dan request ke backend.

## Filter

- `models/todo-filter.test.ts` — default, label, hitungan filter aktif.
- `utils/filter-url.test.ts` — parse/serialize, nilai invalid, tag berulang, rentang khusus, query plan, client filter.
- `TodoFilterPanel.test.tsx` (10 test) — trigger count, chip, hapus satu filter, semua kontrol, rentang khusus, accessible label.
- `WorkspaceTodoSection.test.tsx` — integrasi filter dengan query dan daftar.

## Sorting

- `utils/sort-todos.test.ts` — judul asc/desc, natural numeric (`Task 1`, `Task 2`, `Task 10`), priority, due date, null di akhir untuk kedua arah, createdAt, updatedAt, immutability.
- `TodoSortControl.test.tsx` — pilihan field, arah, accessible name, disabled.
- Workflow F menguji sorting end-to-end melalui UI.

## Workflow integrasi A–F

`src/features/todos/tests/productivity-workflows.test.tsx`:

- **A — Create with metadata**: buka workspace, isi judul, pilih tag, label, priority, due date, reminder, submit; verifikasi body request dan metadata muncul di item.
- **B — Edit metadata**: ubah tag, label, priority, due date, reminder; verifikasi PATCH, PUT tag, PATCH reminder, dan tampilan terbaru.
- **C — Today**: verifikasi endpoint `/todos/today`, `includeCompleted`, `timezone`, tampilan aktif/selesai.
- **D — Upcoming**: verifikasi `/todos/upcoming`, `days=30`, grouping "Besok", dan pengecualian todo tanpa tenggat.
- **E — Filtering**: kombinasi status aktif, priority tinggi, tag, dan due today; hapus satu filter; buka panel lagi; hapus semua; verifikasi daftar selesai.
- **F — Sorting**: judul natural, ubah arah, priority, dan due date termasuk null.

## MSW dan fixture

- Handler default di `src/test/mocks/handlers.ts` mencakup workspace detail, list todo, today, upcoming, overdue, tags, labels, dan reminders.
- Fixture baru: `src/test/fixtures/tags.ts`, `labels.ts`, `reminders.ts`; `todos.ts` diperluas dengan priority/dueAt.
- Fixture tidak diimpor oleh runtime produksi.
- `delay('infinite')` dipakai untuk menguji skeleton tanpa race.
- Input `datetime-local` diuji dengan `fireEvent.change` karena user-event tidak mengetik seluruh nilai input date/time secara natural.

## Konfigurasi

Vitest memakai `maxWorkers: 6` dan `testTimeout: 20_000`. Suite jsdom yang besar dapat memicu timeout palsu jika semua worker berjalan sekaligus; batas ini tidak menonaktifkan assertion atau retry.

## Yang tidak diklaim

- Tidak ada test yang membuktikan notifikasi benar-benar terkirim ke pengguna.
- Tidak ada test backend nyata; kontrak diverifikasi melalui audit source code dan MSW.
- Sorting hanya diuji pada dataset yang dimuat, sesuai batasan implementasi.
