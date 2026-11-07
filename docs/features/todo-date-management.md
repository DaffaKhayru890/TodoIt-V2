# Manajemen Tanggal Todo

Phase 3 membedakan tiga jenis waktu:

| Field | Sumber | Bisa diubah client | Fungsi |
| --- | --- | --- | --- |
| `dueAt` | Client | ya | Deadline todo. |
| `completedAt` | Server | tidak | Waktu todo diselesaikan. |
| `createdAt` / `updatedAt` | Server | tidak | Metadata audit. |

Dokumen ini berfokus pada `dueAt` dan perhitungan tanggal untuk Today/Upcoming/Overdue.

## 1. Format `dueAt`

`dueAt` wajib berupa ISO 8601 **dengan timezone eksplisit**: `Z` atau offset `±HH:MM`.

Diterima:

```text
2026-11-10T09:00:00+07:00
2026-11-10T02:00:00Z
2026-11-10T02:00:00.123Z
```

Ditolak:

```text
2026-11-10T09:00:00        # tanpa timezone
2026-11-10                 # bukan instant
2026-02-30T09:00:00Z       # tanggal tidak ada
```

Input tanpa timezone ditolak agar server tidak menebak timezone pengguna. Setelah diparse, nilai disimpan sebagai instant UTC di kolom `timestamptz`.

Error yang dihasilkan: **422 `TODO_DUE_DATE_INVALID`**.

## 2. Membuat dan menghapus deadline

```json
{ "title": "Kirim laporan", "dueAt": "2026-11-10T09:00:00+07:00" }
```

Tanpa `dueAt`, todo tidak memiliki deadline. Untuk menghapus deadline:

```json
{ "dueAt": null }
```

`undefined` (field tidak dikirim) berarti tidak berubah; `null` berarti menghapus.

## 3. Timezone default

Today/Upcoming/Overdue menerima query `timezone` berisi IANA timezone:

```text
GET /todos/today?timezone=Asia/Jakarta
```

Jika tidak dikirim, aplikasi memakai `APP_DEFAULT_TIMEZONE` (default `UTC`). Nilai harus dikenali `Intl`/`date-fns-tz`; nilai seperti `GMT+7` atau `WIB` ditolak dengan **422 `INVALID_TIMEZONE`**.

## 4. Perhitungan rentang tanggal

Perhitungan dilakukan dengan `date-fns-tz`:

1. Ambil instant `Clock.now()`.
2. Konversi ke “dinding jam” timezone target (`toZonedTime`).
3. Ambil awal hari kalender (`startOfDay`).
4. Konversi kembali ke instant UTC (`fromZonedTime`).
5. Tambah hari kalender pada dinding jam lokal, bukan 24 jam pada UTC.

Interval yang dipakai selalu setengah terbuka:

```text
[startOfDay, startOfNextDay)
```

Dengan cara ini todo tepat tengah malam masuk ke hari berikutnya, dan tidak perlu memakai `23:59:59.999`.

## 5. DST (daylight saving time)

Menambah 24 jam pada UTC akan salah pada hari pergantian DST. Karena itu penambahan hari dilakukan pada waktu lokal:

```text
America/New_York, 2026-03-08:
awal hari      = 2026-03-08T05:00:00Z
awal besok     = 2026-03-09T04:00:00Z   (23 jam kemudian)
```

Test `tests/unit/todo/date-range.test.ts` mencakup rentang yang melewati DST, sehingga interval tetap mengikuti kalender lokal.

## 6. `completedAt` dan `dueAt`

Keduanya independen:

- Menyelesaikan todo tidak mengubah `dueAt`.
- Mengubah `dueAt` tidak mengubah `completedAt`.
- Todo `completed` atau `cancelled` tidak dianggap overdue.

## 7. Overdue bukan perubahan status

Saat waktu melewati `dueAt`, status todo **tidak berubah otomatis**. Overdue dihitung saat request:

```text
dueAt < awal hari ini (timezone request)
```

Dengan demikian tidak ada background job yang diperlukan pada Phase 3, dan hasil view konsisten dengan waktu request.

## 8. Filter tanggal

`dueFrom`/`dueTo` dan `createdFrom`/`createdTo` memakai batas **inclusive** dan format ISO 8601 dengan timezone eksplisit. Bila batas bawah lebih besar dari batas atas, API mengembalikan **422 `INVALID_DATE_RANGE`**.
