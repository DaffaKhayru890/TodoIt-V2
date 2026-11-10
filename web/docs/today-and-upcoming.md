# Today, Upcoming, dan Overdue

Ketiga tampilan memakai endpoint khusus backend dan `timezone` IANA pengguna. Perhitungan batas hari dilakukan backend; frontend memakai tanggal kalender lokal untuk grouping dan label.

## Route

- `/workspace/:workspaceId/today` → `TodayPage`
- `/workspace/:workspaceId/upcoming` → `UpcomingPage`
- `/workspace/:workspaceId?due=overdue` → daftar workspace dengan filter overdue

Keduanya berada di dalam layout workspace, sehingga workspace context dan permission tetap berlaku. Tidak ada route lintas workspace.

## Today

**Endpoint:** `GET /api/v1/workspaces/:workspaceId/todos/today`

Parameter frontend:

- `timezone` dari `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `includeCompleted=true`.
- `limit=100` (halaman pertama).

Semantics backend:

- Rentang `[awal hari ini, awal hari berikutnya)` menurut timezone.
- Status `cancelled` selalu dikecualikan.
- Dengan `includeCompleted=true`, todo `completed` ikut ditampilkan; `completedAt` tidak harus hari ini.
- Todo overdue **tidak** termasuk Today karena berada sebelum awal hari ini.

UI membagi hasil menjadi:

- **Jatuh Tempo Hari Ini** — todo aktif (`todo`, `in_progress`).
- **Selesai Hari Ini** — todo `completed`, hanya dirender jika ada.

Header menampilkan judul Today, tanggal panjang lokal, nama workspace, serta ringkasan jumlah aktif dan selesai. Tombol complete/reopen, edit, dan delete tetap tersedia melalui `TodoItem`.

## Upcoming

**Endpoint:** `GET /api/v1/workspaces/:workspaceId/todos/upcoming`

Parameter frontend:

- `timezone` IANA.
- `days=30` (batas maksimum backend).
- `limit=100`.

Semantics backend:

- Rentang dimulai **besok** (awal hari besok), bukan hari ini.
- Berakhir pada awal hari `today + days + 1`, sehingga `days=30` berarti 30 hari kalender setelah hari ini.
- Status `completed` dan `cancelled` dikecualikan.
- Todo tanpa `dueAt` tidak pernah masuk Upcoming.
- Todo overdue tidak masuk karena berada sebelum awal hari besok.

### Grouping

`groupTodosByDueDate(todos, now)` mengelompokkan berdasarkan tanggal kalender lokal:

- Kunci `YYYY-MM-DD` lokal.
- Label **Hari ini** dan **Besok** dihitung dari tanggal aktual.
- Tanggal lain memakai `formatGroupDate` (`id-ID`, weekday + tanggal + bulan).
- Grup diurutkan kronologis.
- Todo tanpa tenggat difilter sebelum grouping.
- Input tidak dimutasi.

## Overdue

Overdue dapat diakses melalui:

1. **Endpoint** `GET /todos/overdue` — todo dengan `dueAt < awal hari ini`, status `completed` dan `cancelled` dikecualikan.
2. **Filter** `due=overdue` pada daftar workspace.

Filter `due=overdue` menerjemahkan ke `dueFrom = epoch` dan `dueTo = awal hari ini - 1 ms`, lalu menerapkan filter client-side `active-not-overdue` untuk memastikan hanya todo aktif yang overdue yang ditampilkan. Ini diperlukan karena backend belum memiliki parameter status "aktif" gabungan.

Indikator overdue:

- `getDueDateStatus` mengembalikan `overdue` untuk tenggat sebelum awal hari lokal.
- `isTodoOverdue` mengecualikan `completed` dan `cancelled`.
- `TodoItem` menampilkan badge "Terlambat" dengan teks dan ikon, bukan hanya warna.
- Todo selesai tetap menampilkan status selesai, bukan overdue aktif.

## Empty, loading, dan error state

Setiap halaman menyediakan:

- **Loading**: tiga `Skeleton` dengan `aria-busy` dan label "Memuat tugas hari ini" / "Memuat tugas mendatang".
- **Empty**:
  - Today: "You're all clear for today!" dengan deskripsi bahasa Indonesia.
  - Upcoming: "Nothing scheduled ahead."
- **Error**: `EmptyState` dengan pesan `ApiError` dan tombol **Coba lagi**.
- **Feedback mutation**: `role="status"` untuk sukses dan `role="alert"` untuk gagal.

## Timezone dan determinisme

- `now` dihitung sekali per render halaman dengan `useMemo`.
- `TodoItem` menerima prop `now` agar perhitungan badge tidak bergantung pada jam sistem di dalam komponen.
- Utility tanggal menerima `now` eksplisit sehingga dapat diuji dengan fake clock.
- Backend memakai `date-fns-tz` dan menghitung perubahan DST pada dinding jam lokal, bukan menambah 24 jam UTC.

## Batasan

- Hanya halaman pertama (`limit=100`) yang dimuat; belum ada infinite scroll atau pagination UI.
- Today menampilkan todo `completed` yang due hari ini, bukan semua todo yang diselesaikan hari ini. Ini mengikuti semantics backend `dueAt` dan didokumentasikan agar tidak disalahartikan.
- Upcoming tidak menyertakan hari ini; todo due hari ini ada di Today.
- Overdue count global belum tersedia karena backend tidak mengirim total count.
- Filter tag/label pada endpoint view belum diekspos di UI Phase 5.
