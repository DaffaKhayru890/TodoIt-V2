# Sidebar dan navigasi

## Primary

`PrimarySidebar` menampilkan logo TodoIt, caption “Data contoh”, daftar `workspaceFixtures`, tautan “Tambah workspace” ke `/workspaces/new`, avatar, nama “Pengguna contoh”, dan menu yang hanya menuju pengaturan. Nama panjang dipotong dengan ellipsis. Daftar bisa di-scroll terpisah dari header dan footer.

Fixture bukan data produksi. Phase 3 dapat mengganti sumber data tanpa mengubah grid layout.

## Secondary

Item menu tidak ditulis berulang di JSX. `buildNavigation(workspaceId)` mengembalikan section General, Workspace, dan Preferences. Ikon semuanya dari `react-icons/fi`.

| Section     | Item                               |
| ----------- | ---------------------------------- |
| Pencarian   | Cari                               |
| General     | Inbox, Today, Upcoming             |
| Workspace   | All Tasks, Completed, Tags, Labels |
| Preferences | Settings                           |

`NavigationItem` memakai `NavLink`. Item aktif mendapat latar kuning, border hitam, teks tebal, dan bayangan keras, plus `aria-current="page"`. All Tasks memakai `end` agar tidak tetap aktif di child route. Item workspace di sidebar kiri tetap aktif untuk seluruh cabang `/workspace/:id`.

Saat secondary diciutkan, label tetap ada untuk screen reader lewat class `visually-hidden`, dan tooltip muncul untuk pengguna yang melihat ikon.

## Aksesibilitas navigasi

Kedua area memakai `nav`, daftar `ul`, dan tautan sungguhan. Tombol ikon punya `aria-label`. Tidak ada emoji sebagai menu.
