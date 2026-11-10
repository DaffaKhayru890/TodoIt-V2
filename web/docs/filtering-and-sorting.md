# Filtering dan sorting

Filter dapat digabungkan. Sebagian diterjemahkan ke query API, sebagian diterapkan client-side karena backend belum mendukungnya. Sorting sepenuhnya client-side pada halaman pertama.

## Model filter

`TodoFilterState`:

```ts
interface TodoFilterState {
  status: 'all' | 'active' | 'completed';
  priority: TodoPriority | 'all';
  tagIds: string[];
  labelId: string | null;
  due: 'any' | 'no-date' | 'today' | 'tomorrow' | 'next-7-days' | 'overdue' | 'custom';
  customFrom: string | null; // YYYY-MM-DD lokal
  customTo: string | null;
}
```

Nilai default ada di `EMPTY_TODO_FILTER`. `countActiveTodoFilters` dan `hasActiveTodoFilters` dipakai untuk trigger dan chip.

## Dukungan backend

| Filter             | Mekanisme                               | Catatan                                                   |
| ------------------ | --------------------------------------- | --------------------------------------------------------- |
| Status `completed` | `status=completed`                      | Server-side                                               |
| Status `active`    | Client-side                             | Backend tidak punya nilai gabungan `todo` + `in_progress` |
| Status `all`       | Tanpa parameter status                  | Server-side                                               |
| Priority           | `priority=low\|medium\|high\|urgent`    | Server-side                                               |
| Tag                | `tagIds=a&tagIds=b`                     | Server-side, semantics ANY                                |
| Label              | `labelId=...`                           | Server-side                                               |
| Hari ini           | `dueFrom`/`dueTo` awal–akhir hari lokal | Server-side                                               |
| Besok              | `dueFrom`/`dueTo` besok                 | Server-side                                               |
| 7 hari ke depan    | `dueFrom` hari ini, `dueTo` hari ke-6   | Server-side                                               |
| Terlambat          | `dueTo` awal hari ini − 1 ms            | Server-side + client filter aktif                         |
| Tanpa tenggat      | Client-side                             | API tidak punya parameter null                            |
| Rentang khusus     | `dueFrom`/`dueTo`                       | Hanya jika `from <= to`                                   |

Parameter backend lain yang belum diekspos UI: `createdFrom`, `createdTo`, dan `q` (pencarian judul/deskripsi).

### Rentang tanggal

`toTodoListQueryPlan(filter, now)` menghasilkan `{ params, clientFilter }`. `clientFilter` bernilai:

- `none` — tidak ada filter client-side.
- `active` — hanya `todo` dan `in_progress`.
- `no-date` — `dueAt === null`.
- `active-not-overdue` — aktif dan `dueAt` sebelum awal hari ini.

`applyClientTodoFilter` menerapkan filter tersebut pada item yang sudah dimuat.

**Batasan penting:** filter client-side hanya melihat halaman pertama (`limit=100`). UI tidak mengklaim hasil lengkap untuk dataset yang lebih besar. Ini didokumentasikan dan tidak disamarkan sebagai server-side filtering.

## Filter panel

`TodoFilterPanel` memakai `Popover` dari design system. Isi panel:

- Status.
- Prioritas.
- Tenggat, termasuk input `Dari`/`Sampai` saat memilih rentang khusus.
- Tag (checkbox).
- Label (select).

Filter aktif ditampilkan sebagai chip dengan tombol hapus per chip. Tombol **Hapus semua** hanya muncul jika ada filter aktif. Menghapus satu chip tidak mereset chip lain.

Panel menampilkan loading/empty state untuk daftar tag dan label. Jika tag/label workspace kosong, pengguna mendapat penjelasan, bukan dropdown kosong tanpa konteks.

## URL sebagai sumber state

Filter dan sorting disimpan di search params:

| Parameter    | Nilai                                                              | Default (tidak ditulis) |
| ------------ | ------------------------------------------------------------------ | ----------------------- |
| `status`     | `active`, `completed`                                              | `all`                   |
| `priority`   | `low`, `medium`, `high`, `urgent`                                  | `all`                   |
| `tagIds`     | UUID, boleh berulang                                               | kosong                  |
| `labelId`    | UUID                                                               | kosong                  |
| `due`        | `no-date`, `today`, `tomorrow`, `next-7-days`, `overdue`, `custom` | `any`                   |
| `customFrom` | `YYYY-MM-DD`                                                       | kosong                  |
| `customTo`   | `YYYY-MM-DD`                                                       | kosong                  |
| `sort`       | `title`, `dueDate`, `priority`, `createdAt`, `updatedAt`           | `createdAt`             |
| `dir`        | `asc`, `desc`                                                      | `desc`                  |

Contoh:

```text
/workspace/123?status=active&priority=high&tagIds=<uuid>&due=next-7-days&sort=dueDate&dir=asc
```

`parseTodoFilter` dan `parseTodoSort` bersifat defensif:

- Nilai enum tidak dikenal diabaikan dan kembali ke default.
- Tanggal tidak valid atau tanggal kalender palsu (misalnya `2026-02-31`) diabaikan.
- UUID tidak valid dibuang.
- Tag duplikat dinormalisasi.
- Parameter yang tidak relevan tidak mengubah state.

`serializeTodoFilter` dan `serializeTodoSort` mempertahankan parameter lain, menghapus parameter miliknya terlebih dahulu, lalu hanya menulis nilai non-default. Browser back/forward dan refresh mempertahankan state karena state dibaca dari URL, bukan dari state lokal yang terpisah.

## Sorting

Opsi:

| Field       | Label               |
| ----------- | ------------------- |
| `title`     | Judul               |
| `dueDate`   | Tenggat             |
| `priority`  | Prioritas           |
| `createdAt` | Tanggal dibuat      |
| `updatedAt` | Terakhir diperbarui |

Arah `asc` dan `desc` diatur tombol dengan accessible name `Arah pengurutan: Naik/Turun. Klik untuk mengubah.`

### Natural numeric

Judul diurutkan dengan:

```ts
new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
```

Hasilnya: `Task 1`, `Task 2`, `Task 10` — bukan urutan leksikografis. Perbandingan tidak peka huruf besar/kecil.

### Priority

Memakai bobot eksplisit dari `todo-priority.ts` (1–4), bukan alfabet.

### Tanggal null

`dueAt` kosong selalu diletakkan di akhir, baik `asc` maupun `desc`. `createdAt` dan `updatedAt` tidak nullable.

### Immutability

`sortTodos` melakukan `[...todos].sort(...)`. Array dari cache TanStack Query tidak pernah dimutasi. Tie-breaker judul memakai collator yang sama agar hasil deterministik.

## Integrasi halaman

`WorkspaceTodoSection`:

1. Membaca `useSearchParams`.
2. Memparse filter dan sort.
3. Mengirim query plan ke `useWorkspaceTodos`.
4. Menerapkan client filter.
5. Menyalin hasil dan mengurutkannya.
6. Merender daftar aktif dan selesai.

Today dan Upcoming tidak memakai filter panel; keduanya memakai endpoint view dan grouping/status sendiri.

## Batasan

- Sorting tidak didukung backend, sehingga hanya mengurutkan data yang sudah dimuat.
- Pagination lanjutan dan infinite scroll belum ada (Phase 6).
- Filter client-side tidak menjangkau halaman berikutnya.
- Pencarian `q` dan filter tanggal pembuatan belum diekspos di UI.
- Tidak ada multi-label; backend hanya mendukung satu label utama per todo.
