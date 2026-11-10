# Due date dan reminder

## Model due date

Backend menyimpan `dueAt` sebagai **instant** (titik waktu absolut) dan menerima ISO 8601 dengan timezone eksplisit, misalnya `2026-11-12T02:00:00.000Z` atau `2026-11-12T09:00:00+07:00`. Saat respons, `Date` diserialkan sebagai string ISO UTC. Field ini nullable; `null` berarti todo tidak memiliki tenggat.

Tidak ada endpoint due date terpisah. `dueAt` dikirim melalui:

- `POST /todos` saat create.
- `PATCH /todos/:todoId` saat edit, dengan `null` untuk menghapus tenggat.

### date-only vs datetime

TodoIt-v2 **tidak** memakai date-only. Semua tenggat adalah datetime dengan jam dan menit. Karena itu UI memakai input `datetime-local`, bukan input `date` untuk todo.

Nilai `datetime-local` (`YYYY-MM-DDTHH:mm`) dibaca sebagai waktu lokal perangkat, diubah menjadi `Date`, lalu diserialkan dengan `toISOString()` menjadi instant UTC. Tidak ada parsing string tanggal tanpa timezone.

Utility:

- `parseDateTimeInputValue` memvalidasi round-trip kalender (menolak 31 Februari).
- `toDateTimeInputValue` menghasilkan nilai input dari `Date`.
- `toIsoInstant` di mapper menghasilkan ISO instant untuk request.

## Timezone

Strategi:

1. Pengguna memilih waktu lokal.
2. `Date` merepresentasikan instant yang sama di timezone perangkat.
3. Request mengirim ISO instant UTC.
4. Respons diparse menjadi `Date`.
5. Tampilan memakai `Intl.DateTimeFormat('id-ID')` pada timezone perangkat.

Today, Upcoming, dan Overdue mengirim `timezone` IANA dari `Intl.DateTimeFormat().resolvedOptions().timeZone`. Backend memakai timezone itu untuk menghitung batas hari kalender. Jika timezone tidak tersedia, parameter dihilangkan dan backend memakai default `APP_DEFAULT_TIMEZONE`.

Tidak ada konversi tanggal manual berbasis substring string ISO.

## Date picker

`DueDateField` menyediakan:

- Input `datetime-local`.
- Tombol hapus tenggat.
- Shortcut **Hari ini**, **Besok**, dan **Minggu depan** pada pukul 09:00 waktu lokal.
- Preview tanggal terformat.
- Pesan error aksesibel.
- Prop `now` yang dapat diinjeksi agar test deterministik.

Shortcut tidak mengubah due date yang sudah ada secara diam-diam; pengguna dapat mengubah input setelah memilih shortcut.

## Status due date

`getDueDateStatus(dueAt, now, completed)` mengembalikan:

- `none` — tidak ada tenggat.
- `completed` — todo selesai; tidak dianggap overdue aktif.
- `today` — tanggal kalender lokal sama dengan hari ini.
- `overdue` — sebelum awal hari lokal.
- `upcoming` — setelah hari ini.

Perbandingan memakai awal hari lokal, bukan string. Todo `cancelled` tidak dianggap overdue aktif oleh `isTodoOverdue`.

## Reminder

### Model backend

Reminder adalah resource anak todo:

```ts
interface Reminder {
  id: string;
  todoId: string;
  triggerType: 'absolute' | 'before_due';
  remindAt: Date | null;
  offsetMinutes: number | null;
  effectiveAt: Date | null;
  status: 'scheduled' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
}
```

Endpoint:

- `GET /todos/:todoId/reminders?status&limit&cursor`
- `GET /todos/:todoId/reminders/:reminderId`
- `POST /todos/:todoId/reminders`
- `PATCH /todos/:todoId/reminders/:reminderId`
- `DELETE /todos/:todoId/reminders/:reminderId`

Aturan:

- `before_due` wajib `offsetMinutes` 1–43.200 dan todo harus memiliki `dueAt`.
- `absolute` wajib `remindAt` di masa depan.
- `triggerType` immutable; PATCH hanya boleh mengubah field yang sesuai tipe.
- `DELETE` membatalkan reminder (`cancelled`), bukan menghapus baris dari database.
- Daftar default hanya menampilkan `scheduled`.

### UI

`ReminderSelector` menyediakan:

- Checkbox aktif/nonaktif.
- Pilihan 5 menit, 15 menit, 30 menit, 1 jam, dan 1 hari sebelum tenggat.
- State disabled jika todo belum punya due date.
- Ringkasan jadwal.
- Pesan error.

Opsi "tepat pada tenggat" **tidak disediakan** karena backend mensyaratkan offset minimal 1 menit. Frontend hanya memakai `before_due`; `absolute` belum diekspos di UI.

### Alur create dan edit

- **Create**: todo dibuat lebih dahulu, lalu reminder `before_due` dibuat jika dipilih. Jika pembuatan reminder gagal, todo tetap ada dan dialog menampilkan peringatan parsial.
- **Edit**: reminder yang ada dibandingkan dengan pilihan form.
  - Offset berubah → PATCH `{ offsetMinutes }`.
  - Pengingat dimatikan → DELETE (cancel).
  - Belum ada lalu diaktifkan → POST.
- Perubahan due date tidak membuat ulang reminder; backend menghitung `effectiveAt` secara dinamis dari `dueAt - offsetMinutes`.

### Scheduling dan delivery

Frontend **tidak** memakai `setTimeout`, `setInterval`, atau browser notification sebagai scheduler. Frontend hanya menyimpan konfigurasi.

Backend memiliki Notification Engine dan worker yang dapat memproses job reminder. Pengiriman aktual bergantung pada konfigurasi deployment, terutama `notificationWorkerEnabled` dan koneksi database/email. Dokumentasi ini tidak mengklaim reminder terkirim jika worker tidak berjalan.

## Batasan

- Reminder `absolute` belum tersedia di UI.
- Tidak ada browser notification dan notification center pada Phase 5.
- Tidak ada reminder berulang (recurring).
- Jika backend menolak offset (misalnya due date sudah lewat), error ditampilkan sebagai `ApiError`, bukan disembunyikan.
- Perhitungan Today/Upcoming/Overdue di UI memakai waktu perangkat; perhitungan otoritatif tetap backend berdasarkan `timezone` yang dikirim.
