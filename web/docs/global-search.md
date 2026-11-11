# Pencarian global

Phase 6 menambahkan pencarian global untuk tugas, tag, dan label dari seluruh workspace yang dapat diakses pengguna. Pencarian dapat dibuka lewat tombol **Cari** di sidebar, halaman `/search`, atau shortcut `Ctrl+K` / `Cmd+K`.

## Kondisi backend

Backend **tidak memiliki endpoint pencarian global**. Yang tersedia hanya parameter `q` pada endpoint per workspace:

- `GET /api/v1/workspaces/:workspaceId/todos?q=...`
- `GET /api/v1/workspaces/:workspaceId/tags?q=...`
- `GET /api/v1/workspaces/:workspaceId/labels?q=...`

Karena itu frontend melakukan **fan-out** ke setiap workspace. Pendekatan ini bukan endpoint palsu: semua hasil berasal dari API nyata dan tidak ada data mock di production.

Keterbatasan yang terdokumentasi:

- Pencarian nama workspace `BLOCKED`. `GET /api/v1/workspaces` tidak menerima parameter `q` dan hanya memakai offset pagination.
- Endpoint saran pencarian (suggestions) tidak ada. Daftar saran memakai hasil pencarian nyata yang sudah dimuat.
- Peringkat relevansi global tidak tersedia. Urutan item mengikuti urutan backend per kategori.
- Pencarian hanya mencakup `todo`, `tag`, dan `label`. Kategori workspace sengaja tidak dibuat.

## Alur data

1. `useSearchWorkspaces` memuat seluruh workspace dengan `limit=50` dan offset sampai `total` terpenuhi, maksimal 10 halaman. Batas ini mencegah loop tak berujung sekaligus menghormati limit backend.
2. `useGlobalSearch` menormalkan query, menunggu debounce 300 ms, lalu menjalankan fan-out bila panjang query minimal 2 karakter.
3. Untuk setiap workspace, `searchApi` memanggil tiga endpoint secara paralel:
   - todo: `limit=8`
   - tag: `limit=5`
   - label: `limit=5`
4. Fan-out memakai `Promise.allSettled`. Workspace yang gagal tidak menggagalkan seluruh pencarian; hasil workspace lain tetap ditampilkan dan jumlah kegagalan dilaporkan lewat `failedWorkspaces`.
5. `AbortSignal` diteruskan ke HTTP client. Saat query berubah, request lama dibatalkan sehingga hasil lama tidak menimpa hasil baru.
6. Item digabung per kategori dan dideduplikasi berdasarkan ID backend.

## Batas query

| Aturan                | Nilai                                          |
| --------------------- | ---------------------------------------------- |
| Panjang minimum       | 2 karakter setelah normalisasi                 |
| Panjang maksimum      | 200 karakter                                   |
| Debounce              | 300 ms                                         |
| Riwayat pencarian     | maksimal 8 entri                               |
| Penyimpanan riwayat   | `localStorage` kunci `todoit.search.recent.v1` |
| Maksimum per kategori | todo 8, tag 5, label 5 per workspace           |

Normalisasi mengubah spasi berulang menjadi satu spasi dan memangkas spasi di awal/akhir. Deduplikasi riwayat memakai perbandingan case-insensitive dengan locale `id-ID`.

## Komponen dan hook

| Berkas                                                            | Peran                                               |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| `features/search/models/search.model.ts`                          | Tipe hasil, konstanta, normalisasi query            |
| `features/search/api/search.api.ts`                               | Fan-out tiga endpoint per workspace                 |
| `features/search/api/search.query-keys.ts`                        | Query key pencarian dan daftar workspace            |
| `features/search/hooks/use-search-workspaces.ts`                  | Memuat seluruh workspace dengan offset pagination   |
| `features/search/hooks/use-global-search.ts`                      | Debounce, fan-out, status query                     |
| `features/search/hooks/use-search-keyboard.ts`                    | Navigasi `ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter` |
| `features/search/hooks/use-search-shortcut.ts`                    | Shortcut `Ctrl+K`/`Cmd+K`, mengabaikan target input |
| `features/search/hooks/use-recent-searches.ts`                    | Baca/tambah/hapus/bersihkan riwayat                 |
| `features/search/utils/debounce.ts`                               | Hook debounce generik                               |
| `features/search/utils/highlight-search.ts`                       | Pemecahan teks untuk penanda hasil                  |
| `features/search/utils/recent-searches.ts`                        | Serialisasi, validasi, dan dedupe riwayat           |
| `features/search/components/search-content/SearchContent.tsx`     | Input, hasil terkelompok, state kosong/error        |
| `features/search/components/search-popup/SearchPopup.tsx`         | Dialog pencarian global                             |
| `features/search/components/search-trigger/SearchTrigger.tsx`     | Tombol pembuka di sidebar                           |
| `features/search/components/highlighted-text/HighlightedText.tsx` | Menampilkan bagian teks yang cocok dengan `<mark>`  |
| `features/search/pages/SearchPage.tsx`                            | Halaman `/search`                                   |

## Hasil dan navigasi

Hasil dikelompokkan menjadi **Tugas**, **Tag**, dan **Label**. Setiap item menampilkan judul, deskripsi singkat bila ada, dan nama workspace.

- Tugas membuka `/workspace/:workspaceId/todos/:todoId`.
- Tag membuka halaman tag workspace.
- Label membuka halaman label workspace.

Item aktif dapat dipilih dengan keyboard. `Enter` membuka item aktif; jika tidak ada item aktif, query disimpan ke riwayat. `Escape` menutup dialog. `aria-activedescendant` dan `role="listbox"`/`role="option"` dipakai agar navigasi terbaca oleh pembaca layar.

## Riwayat pencarian

Riwayat hanya disimpan di browser pengguna dan tidak dikirim ke backend. Perilaku:

- menambah query yang berhasil dijalankan;
- memindahkan query lama ke depan bila diulang (case-insensitive);
- membatasi maksimal 8 entri;
- mendukung hapus satu entri, hapus semua, dan pakai ulang;
- data rusak atau tidak valid diabaikan saat dibaca.

## State dan error

- Query terlalu pendek menampilkan petunjuk minimal 2 karakter.
- Tidak ada hasil menampilkan empty state.
- Kegagalan seluruh workspace menampilkan pesan error dan tombol **Coba lagi**.
- Kegagalan sebagian menampilkan hasil yang berhasil beserta peringatan jumlah workspace yang gagal.
- Kegagalan daftar workspace menampilkan pesan khusus tanpa menjalankan fan-out.
- Tidak ada workspace menampilkan petunjuk bahwa belum ada workspace yang dapat dicari.

## Pengujian

Test berada di `features/search/`:

- `utils/debounce.test.tsx`
- `utils/recent-searches.test.ts`
- `utils/highlight-search.test.ts`
- `components/highlighted-text/HighlightedText.test.tsx`
- `api/search.api.test.ts`
- `hooks/search-hooks.test.tsx`
- `components/search-content/SearchContent.test.tsx`
- `components/search-trigger/SearchTrigger.test.tsx`
- `tests/search-workflows.test.tsx`

Workflow A membuka pencarian lewat `Ctrl+K`, mencari lintas workspace, lalu membuka hasil ke detail tugas. Workflow B memakai ulang dan membersihkan riwayat pencarian.
