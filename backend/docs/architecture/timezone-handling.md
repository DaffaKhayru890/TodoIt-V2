# Arsitektur — Timezone Handling

## 1. Prinsip

1. **Semua timestamp disimpan dalam UTC** (`timestamptz`, atau `timestamp with time zone`
   yang dikirim dalam UTC). Tidak ada waktu lokal yang disimpan.
2. **Timezone adalah atribut user**, disimpan sebagai IANA identifier (`Asia/Jakarta`,
   `America/New_York`, dst) di `users.timezone`.
3. **Perhitungan "hari" dilakukan di Go**, bukan di SQL, karena SQL tidak memiliki konsep
   timezone per-user dan DST membutuhkan aturan kalender.
4. **Batas hari bersifat half-open**: `[start, end)`. Ini mencegah task di tengah malam
   terhitung dua kali.
5. **Default timezone** jika user belum mengatur: `UTC`.

## 2. Mengapa Tidak Menyimpan Offset

Offset (`+07:00`) tidak cukup karena:

- DST berubah sepanjang tahun (mis. New York `-05:00` di musim dingin, `-04:00` di musim
  panas).
- Offset tidak memiliki aturan transisi; menyimpan offset berarti menyimpan snapshot yang
  tidak dapat dipakai untuk tanggal lain.

IANA identifier menyimpan aturan historis dan future transition melalui tzdata. Go memuat
tzdata dari sistem; untuk image minimal (distroless) kita menyertakan `time/tzdata` atau
menyalin zoneinfo.

## 3. Entitas dan Kolom

| Tabel | Kolom | Tipe | Catatan |
|---|---|---|---|
| `users` | `timezone` | `varchar(64)` | IANA, validated |
| `tasks` | `due_at` | `timestamptz NULL` | UTC |
| `tasks` | `completed_at` | `timestamptz NULL` | UTC |
| `reminders` | `scheduled_at` | `timestamptz` | UTC |
| `reminders` | `sent_at` | `timestamptz NULL` | UTC |
| `notifications` | `created_at` | `timestamptz` | UTC |
| Semua tabel | `created_at`, `updated_at` | `timestamptz` | UTC |

GORM akan memetakan `time.Time` ke `timestamptz`. Service selalu menyimpan `time.UTC`.

## 4. Validasi Timezone

```go
func ValidateTimezone(name string) (*time.Location, error) {
    if name == "" {
        return time.UTC, nil
    }
    loc, err := time.LoadLocation(name)
    if err != nil {
        return nil, ErrInvalidTimezone
    }
    // Tolak "Local" agar perilaku tidak bergantung pada environment container.
    if name == "Local" {
        return nil, ErrInvalidTimezone
    }
    return loc, nil
}
```

Aturan:

- Panjang maksimal 64 karakter.
- Case-sensitive sesuai IANA (`Asia/Jakarta`, bukan `asia/jakarta`).
- `Local` ditolak karena bergantung pada `/etc/localtime` container.
- Timezone tidak valid → 422 `VALIDATION_ERROR` pada `PATCH /users/me`.

## 5. Menghitung Batas Hari Lokal

### 5.1 Rumus

Untuk tanggal lokal `D` di location `L`:

```text
startLocal = time.Date(D.year, D.month, D.day, 0, 0, 0, 0, L)
endLocal   = startLocal.AddDate(0, 0, 1)
startUTC   = startLocal.UTC()
endUTC     = endLocal.UTC()
```

**Jangan** memakai `startLocal.Add(24 * time.Hour)`. Pada hari transisi DST, hari lokal bisa
23 atau 25 jam. `AddDate(0, 0, 1)` memakai kalender dan menghasilkan tengah malam berikutnya
yang benar.

### 5.2 Kode

```go
type DayRange struct {
    StartUTC time.Time
    EndUTC   time.Time
    LocalDate string // YYYY-MM-DD
}

func LocalDayRange(now time.Time, loc *time.Location) DayRange {
    local := now.In(loc)
    start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
    end := start.AddDate(0, 0, 1)
    return DayRange{
        StartUTC:  start.UTC(),
        EndUTC:    end.UTC(),
        LocalDate: start.Format("2006-01-02"),
    }
}
```

### 5.3 Contoh: Asia/Jakarta (tanpa DST)

`now = 2026-11-12T03:00:00Z` → lokal `2026-11-12T10:00:00+07:00`.

| Batas | Lokal | UTC |
|---|---|---|
| Start | `2026-11-12 00:00:00 +07:00` | `2026-11-11 17:00:00Z` |
| End | `2026-11-13 00:00:00 +07:00` | `2026-11-12 17:00:00Z` |

Query Today:

```sql
WHERE workspace_id = $1
  AND due_at >= '2026-11-11T17:00:00Z'
  AND due_at <  '2026-11-12T17:00:00Z'
  AND status <> 'DONE'
  AND deleted_at IS NULL
```

### 5.4 Contoh: America/New_York (DST)

**Musim panas** (EDT, UTC-4), `2026-07-15`:

| Batas | Lokal | UTC |
|---|---|---|
| Start | `2026-07-15 00:00 -04:00` | `2026-07-15 04:00Z` |
| End | `2026-07-16 00:00 -04:00` | `2026-07-16 04:00Z` |

**Musim dingin** (EST, UTC-5), `2026-12-15`:

| Batas | Lokal | UTC |
|---|---|---|
| Start | `2026-12-15 00:00 -05:00` | `2026-12-15 05:00Z` |
| End | `2026-12-16 00:00 -05:00` | `2026-12-16 05:00Z` |

**Hari transisi DST** (spring forward, `2026-03-08` di US): hari hanya 23 jam.
`start = 2026-03-08 00:00 EST`, `end = 2026-03-09 00:00 EDT`, selisih 23 jam. Rumus
`AddDate` menghasilkan batas yang benar; `Add(24h)` akan salah (menjadi 01:00 lokal).

**Fall back** (`2026-11-01`): hari 25 jam. `AddDate` benar; `Add(24h)` akan berakhir di
23:00 hari yang sama.

## 6. Today

Definisi: task dengan `due_at` di dalam hari lokal user saat ini, dan belum selesai.

```text
userTimezone = users.timezone (default UTC)
range = LocalDayRange(now, tz)
WHERE workspace_id = ?
  AND due_at >= range.StartUTC
  AND due_at <  range.EndUTC
  AND status <> 'DONE'
  AND deleted_at IS NULL
ORDER BY due_at ASC, id ASC
```

Catatan:

- Task due `2026-11-12 23:30 WIB` (= `16:30Z`) masuk Today untuk user Jakarta, meskipun
  bagi user UTC itu masih tanggal 12 pukul 16:30 — konsisten karena keduanya tanggal 12.
- Task due `2026-11-13 00:30 WIB` (= `2026-11-12 17:30Z`) **tidak** masuk Today Jakarta,
  tetapi masuk Today UTC. Ini konsekuensi yang benar dari definisi per-user.
- Batas menggunakan `< end`, bukan `<= end`, agar task tepat tengah malam tidak dobel.

## 7. Upcoming

Definisi: task dengan `due_at` setelah hari ini berakhir, dalam rentang N hari ke depan.

```text
upcomingDays = env UPCOMING_DAYS (default 7, min 1, max 30)
today = LocalDayRange(now, tz)
start = today.EndUTC
end   = start_of_local_day(now + upcomingDays) dalam tz, dikonversi UTC
WHERE due_at >= start AND due_at < end
  AND status <> 'DONE'
  AND deleted_at IS NULL
ORDER BY due_at ASC, id ASC
```

Perhitungan `end` harus memakai kalender lokal, bukan `start.Add(N*24h)`:

```go
func UpcomingRange(now time.Time, loc *time.Location, days int) DayRange {
    today := LocalDayRange(now, loc)
    local := now.In(loc)
    endLocal := time.Date(local.Year(), local.Month(), local.Day()+days, 0, 0, 0, 0, loc)
    return DayRange{StartUTC: today.EndUTC, EndUTC: endLocal.UTC()}
}
```

Contoh Jakarta, `now = 2026-11-12 10:00 WIB`, `days = 7`:

| Batas | UTC |
|---|---|
| Start (besok 00:00 WIB) | `2026-11-12T17:00:00Z` |
| End (19 Nov 00:00 WIB) | `2026-11-18T17:00:00Z` |

Artinya Upcoming mencakup 13–18 November (6 hari penuh setelah hari ini) hingga awal 19
November. Jika ingin "7 hari termasuk hari ini", gunakan `days = 8` pada perhitungan end.
**Keputusan:** `UPCOMING_DAYS=7` berarti 7 hari setelah hari ini (tidak termasuk hari ini),
karena Today sudah menampilkan hari ini. Dokumentasikan di OpenAPI.

## 8. Overdue

Definisi: task yang `due_at` sudah lewat dan belum selesai.

```sql
WHERE workspace_id = $1
  AND due_at < now()
  AND status <> 'DONE'
  AND deleted_at IS NULL
ORDER BY due_at ASC, id ASC
```

- Overdue bersifat global (tidak per-hari); task overdue dari minggu lalu tetap muncul.
- Task yang due hari ini pukul 09:00 dan sekarang 10:00 sudah overdue, tetapi juga masih
  memenuhi Today (karena due_at di dalam rentang hari). Ini disengaja: Today = agenda hari
  ini, Overdue = peringatan keterlambatan.
- Task tanpa `due_at` tidak pernah overdue.
- Task DONE tidak pernah overdue meskipun `completed_at` setelah `due_at`.

## 9. Perbandingan "Hari Ini" untuk Notifikasi

Worker berjalan di server (UTC) dan harus menentukan apakah sebuah task "due today" untuk
user tertentu. Aturannya:

1. Ambil `users.timezone`.
2. Hitung `LocalDayRange(now, tz)`.
3. Bandingkan `due_at` dengan rentang tersebut.

Worker **tidak** boleh memakai `time.Now().Format("2006-01-02")` karena itu tanggal server.

Untuk notifikasi overdue harian, `dedupe_key` memakai `local_date` user:
`task_overdue:{task_id}:{local_date}` sehingga satu notifikasi per task per hari lokal.

## 10. DST Edge Cases

| Kasus | Perilaku |
|---|---|
| Tengah malam tidak ada (rare, mis. perubahan zona) | `time.Date` menormalkan ke waktu valid berikutnya; rentang hari tetap dihitung dari hasil normalisasi |
| Tengah malam ambigu (fall back) | `time.Date` memilih occurrence pertama; konsisten |
| Hari 23 jam | `AddDate(0,0,1)` benar; durasi query 23 jam |
| Hari 25 jam | `AddDate(0,0,1)` benar; durasi query 25 jam |
| User mengganti timezone | Task yang sama dapat berpindah kategori Today/Upcoming; tidak ada migrasi data |
| Perhitungan di SQL `date_trunc('day', due_at)` | **Dilarang** karena memakai timezone server |

## 11. Penyimpanan dan Serialisasi API

- Input: RFC3339 wajib memiliki offset (`2026-11-12T17:00:00+07:00` atau `...Z`). Input tanpa
  offset ditolak 422.
- Output: selalu UTC dengan suffix `Z` (`2026-11-12T10:00:00Z`).
- Frontend bertanggung jawab mengonversi ke timezone user untuk tampilan.
- `today`/`upcoming`/`overdue` response menyertakan metadata rentang:

```json
{
  "meta": {
    "timezone": "Asia/Jakarta",
    "date": "2026-11-12",
    "range_start": "2026-11-11T17:00:00Z",
    "range_end": "2026-11-12T17:00:00Z",
    "upcoming_days": null
  }
}
```

Untuk Upcoming, `date` adalah tanggal hari ini dan `range_end` adalah batas akhir.

## 12. Konfigurasi

| Env | Default | Keterangan |
|---|---|---|
| `DEFAULT_TIMEZONE` | `UTC` | Dipakai jika user.timezone kosong |
| `UPCOMING_DAYS` | `7` | Rentang Upcoming (1–30) |
| `TZ` | `UTC` | Timezone proses; **tidak** dipakai untuk perhitungan user |

Container production sebaiknya tetap `TZ=UTC` agar log konsisten. Perhitungan user selalu
memakai `users.timezone`, bukan `TZ`.

## 13. Testing Timezone

Test wajib (Phase 5):

| Test | Input | Ekspektasi |
|---|---|---|
| Today Jakarta | now `2026-11-12T03:00Z` | range `17:00Z` s/d `17:00Z` besok |
| Today New York summer | now `2026-07-15T12:00Z` | start `04:00Z` |
| Today New York winter | now `2026-12-15T12:00Z` | start `05:00Z` |
| Spring forward | `2026-03-08` NY | durasi 23 jam |
| Fall back | `2026-11-01` NY | durasi 25 jam |
| Upcoming 7 hari | Jakarta | end = awal hari ke-7 |
| Overdue | due kemarin, status TODO | masuk |
| DONE | due kemarin, status DONE | tidak masuk |
| Tanpa due date | due null | tidak masuk semua view |
| Timezone invalid | `Asia/Nowhere` | 422 |

Test menggunakan `time.FixedZone`/`time.LoadLocation` dan **tidak** bergantung pada waktu
sekarang; waktu selalu diinjeksi lewat interface `Clock` di service.

## 14. Keputusan dan Trade-off

| Keputusan | Alasan | Alternatif |
|---|---|---|
| UTC storage | Konsisten, aman untuk multi-timezone | Simpan lokal (ambigu saat DST) |
| Perhitungan di Go | Aturan kalender lengkap, mudah diuji | SQL `AT TIME ZONE` (coupling ke DB, sulit diuji) |
| Half-open range | Tidak ada double counting | `BETWEEN` inklusif (rawan batas) |
| Timezone per user | Sesuai kebutuhan | Timezone per workspace (tidak diminta) |
| `UPCOMING_DAYS` env | Fleksibel | Hardcode 7 |
| Today & Overdue tumpang tindih | Sesuai semantik berbeda | Saling eksklusif (menyulitkan UI) |
