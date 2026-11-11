# Cursor pagination dan infinite scrolling

Phase 6 memakai cursor pagination backend untuk daftar tugas workspace dan pusat notifikasi. Tujuannya agar daftar besar tidak dimuat sekaligus dan pengguna dapat melanjutkan halaman berikutnya tanpa offset yang rapuh.

## Kontrak backend

`GET /api/v1/workspaces/:workspaceId/todos` mengembalikan:

```json
{
  "items": [],
  "pagination": {
    "limit": 30,
    "hasMore": true,
    "nextCursor": "cursor-opaque"
  }
}
```

Aturan yang dipegang frontend:

- `limit` untuk infinite scroll tugas adalah **30**.
- cursor selalu berasal dari `pagination.nextCursor` respons sebelumnya;
- frontend tidak membangun, menebak, atau menyimpan cursor sendiri;
- cursor pemanggil diabaikan oleh `useInfiniteWorkspaceTodos` agar parameter eksternal tidak merusak urutan;
- `hasMore=false` berarti tidak ada halaman berikutnya.

Daftar notifikasi memakai aturan yang sama dengan `limit=20`.

## Hook tugas

`useInfiniteWorkspaceTodos(workspaceId, params, { sort })` membungkus `useInfiniteQuery`:

- `initialPageParam` adalah `undefined`;
- `queryFn` mengirim `...params`, `limit`, dan `cursor` hanya jika `pageParam` ada;
- `getNextPageParam` mengembalikan `nextCursor` bila `hasMore`, selain itu `undefined`;
- `sort` **tidak dikirim ke backend** karena backend tidak memiliki parameter sorting;
- `sort` tetap menjadi bagian query key agar perubahan sorting memulai pagination dari halaman pertama;
- `staleTime` 30 detik dan retry mengikuti aturan query todo.

Query key memakai `todoKeys.workspaceInfinite`. Scope berisi `params` dan `sort`, sehingga cache halaman tidak tercampur antar filter, workspace, atau sorting.

## Penggabungan halaman

`flattenTodoPages(workspaceId, pages)`:

1. membaca seluruh `items` dari halaman yang sudah dimuat;
2. membuang item yang `workspaceId`-nya berbeda dari workspace aktif sebagai pertahanan cache;
3. membuang duplikat berdasarkan ID;
4. mempertahankan urutan halaman.

Dengan demikian, halaman yang tumpang tindih karena data berubah saat pagination tidak menghasilkan kartu ganda.

## Filter dan sorting client-side

Filter yang tidak didukung backend (`active`, `no-date`, rentang kustom) serta sorting diterapkan setelah halaman digabungkan. Konsekuensinya:

- filter dan sorting hanya berlaku pada halaman yang **sudah dimuat**;
- tugas yang cocok tetapi belum dimuat belum terlihat sampai pengguna memuat halaman berikutnya;
- empty state karena filter tidak berarti backend tidak punya data, hanya tidak ada kecocokan pada halaman yang dimuat;
- perubahan filter atau sorting mereset query key dan pagination.

Batasan ini disengaja karena backend belum menyediakan sorting server-side maupun seluruh variasi filter. Dokumentasi filter lengkap ada di [filtering-and-sorting.md](filtering-and-sorting.md).

## UI daftar

`TodoList` menerima state pagination dari `WorkspaceTodoSection`:

- skeleton saat halaman pertama dimuat;
- error halaman pertama dengan tombol **Coba lagi**;
- sentinel di bagian bawah daftar;
- `IntersectionObserver` memicu `fetchNextPage()` saat sentinel terlihat;
- tombol **Muat lebih banyak** sebagai fallback bila `IntersectionObserver` tidak tersedia;
- indikator loading halaman berikutnya;
- pesan error halaman berikutnya dengan tombol coba lagi tanpa menghapus item yang sudah tampil;
- indikator **Semua tugas sudah dimuat.** saat `hasMore=false`;
- `aria-busy` pada area daftar saat halaman berikutnya dimuat.

`useIntersectionObserver` menyimpan callback terbaru di ref sehingga perubahan callback tidak membuat observer baru. `rootMargin` dan `threshold` dapat dikonfigurasi; `enabled=false` memutus observer.

## Pemulihan posisi scroll

Scroll container aplikasi adalah `#main-content`. Phase 6 menambahkan:

- `scroll-position-storage.ts` untuk membaca, menulis, dan menghapus posisi di `localStorage`;
- `use-scroll-restoration.ts` untuk menyimpan posisi saat scroll dan saat unmount, lalu memulihkannya ketika daftar siap;
- `buildWorkspaceScrollKey.ts` untuk membuat kunci stabil dari workspace, filter, dan sorting.

Perilaku:

- posisi disimpan per kombinasi workspace + filter + sorting;
- saat kunci berubah, scroll direset ke atas agar filter baru tidak mewarisi posisi lama;
- posisi dipulihkan setelah query sukses (`ready=true`);
- nilai rusak, negatif, atau tidak ada dianggap `0`;
- kegagalan `localStorage` (misalnya mode privat atau kuota) diabaikan tanpa memecahkan halaman.

Workflow D menguji posisi scroll tetap 400 px setelah pengguna membuka detail tugas lalu kembali ke workspace.

## Keterbatasan

| Kebutuhan                       | Status    | Keterangan                               |
| ------------------------------- | --------- | ---------------------------------------- |
| Cursor pagination tugas         | Available | `limit=30`, cursor dari backend          |
| Cursor pagination notifikasi    | Available | `limit=20`, cursor dari backend          |
| Infinite scroll dengan sentinel | Available | Fallback tombol tersedia                 |
| Pemulihan scroll                | Available | Per workspace + filter + sorting         |
| Sorting server-side             | BLOCKED   | Backend tidak menerima parameter sorting |
| Filter penuh server-side        | Sebagian  | `active` dan `no-date` client-side       |
| Total count tugas               | BLOCKED   | Respons pagination tidak mengirim total  |
| Virtualisasi daftar             | Belum     | Tidak diperlukan untuk skala saat ini    |

## Pengujian

- `features/todos/utils/infinite-todo-utils.test.ts` — flatten, dedupe, workspace guard, scroll key, storage.
- `features/todos/hooks/use-infinite-workspace-todos.test.tsx` — cursor, limit, pengabaian cursor pemanggil, query key sorting.
- `hooks/use-intersection-observer.test.tsx` — opsi observer, callback terbaru, cleanup, unsupported.
- `hooks/use-scroll-restoration.test.tsx` — restore, simpan, reset saat kunci berubah, tanpa container.
- `features/todos/tests/infinite-workflows.test.tsx` — Workflow C (sentinel dan fallback tombol) serta Workflow D (scroll restoration).
