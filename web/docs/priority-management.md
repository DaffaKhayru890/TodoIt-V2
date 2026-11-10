# Priority management

Priority adalah field todo, bukan resource terpisah. Backend menggunakan enum `low | medium | high | urgent` dengan default `low` saat create jika field tidak dikirim.

## Enum dan representasi API

| Nilai API | Label UI | Bobot sorting | Varian visual       |
| --------- | -------- | ------------- | ------------------- |
| `low`     | Rendah   | 1             | netral              |
| `medium`  | Sedang   | 2             | peringatan (kuning) |
| `high`    | Tinggi   | 3             | bahaya (oranye)     |
| `urgent`  | Mendesak | 4             | bahaya (merah)      |

Label dan bobot tidak pernah dikirim ke backend. Hanya nilai enum yang masuk ke request.

Field priority selalu ada pada representasi todo. `priority` opsional pada create (default backend `low`) dan opsional pada PATCH.

## Model frontend

`src/features/todos/models/todo-priority.ts` menyimpan `PRIORITY_CONFIG`:

```ts
interface PriorityConfig {
  value: TodoPriority;
  label: string;
  sortWeight: number;
  badgeVariant: 'neutral' | 'warning' | 'danger';
  cssModifier: string;
}
```

Fungsi turunan:

- `getPriorityConfig(priority)`
- `getPriorityLabel(priority)`
- `getPriorityWeight(priority)`

`isTodoPriority` dipakai guard respons dan parser filter. Nilai di luar enum ditolak, bukan dipetakan diam-diam ke default.

## Priority selector

`PrioritySelector` adalah native `<select>` dengan label "Prioritas", hint, state disabled, dan pesan error. Native select dipilih agar navigasi keyboard dan screen reader bekerja tanpa JavaScript tambahan.

Nilai awal form create adalah `low` sesuai default backend. Pada edit, nilai diisi dari todo yang sedang diubah.

## Priority badge

`PriorityBadge` menampilkan teks label, bukan hanya warna. Ini memenuhi kebutuhan aksesibilitas: pengguna tetap dapat membedakan prioritas tanpa persepsi warna.

Badge dipakai pada:

- `TodoItem`
- `TodoDetailPage`
- hasil filter dan sorting

`TodoMetadata` mengatur susunan badge agar judul todo tetap menjadi informasi utama.

## Integrasi form

- **Create Todo**: priority dikirim hanya jika berbeda dari default `low`. Jika pengguna membiarkan `low`, field tidak dikirim dan backend memakai default.
- **Edit Todo**: priority hanya masuk PATCH jika nilainya berubah.
- **Todo Detail**: menampilkan badge priority dari data backend.
- **Todo Item**: menampilkan badge priority di area metadata.

## Sorting berdasarkan priority

Sorting priority dilakukan client-side karena backend tidak menyediakan parameter sort. `sortTodos` memakai bobot eksplisit (bukan urutan alfabet):

- `urgent` (4) di atas `high` (3), `medium` (2), `low` (1).
- Arah `desc` menampilkan prioritas tertinggi lebih dahulu.
- Arah `asc` menampilkan prioritas terendah lebih dahulu.
- Jika bobot sama, tie-breaker memakai judul dengan `Intl.Collator`.

## Cache

Mengubah priority melalui PATCH todo menginvalidasi daftar todo workspace dan memperbarui cache detail todo. Jika filter priority sedang aktif, query key yang memuat filter tersebut juga ikut invalid karena berada di bawah `todoKeys.workspaceLists(workspaceId)`.

## Batasan

- Tidak ada endpoint priority terpisah.
- Tidak ada sorting priority server-side.
- Tidak ada bulk update priority.
- `cancelled` tetap bukan status aktif; todo `cancelled` tidak dirender sebagai item aktif meskipun memiliki priority.
