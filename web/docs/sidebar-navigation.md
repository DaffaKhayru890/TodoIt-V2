# Sidebar dan navigasi

## Primary

`PrimarySidebar` menampilkan logo TodoIt, judul section Workspace, daftar workspace dari `GET /api/v1/workspaces` melalui `useWorkspaces`, tombol “Tambah workspace” yang membuka `CreateWorkspaceDialog`, area profil, dan menu pengaturan. Nama panjang dipotong dengan ellipsis dan `title` menyimpan nama lengkap. Daftar bisa di-scroll terpisah dari header dan footer.

State yang ditangani:

- **Loading:** skeleton, tanpa empty state prematur.
- **Error:** alert + tombol “Coba lagi”; daftar cache tetap ditampilkan bila tersedia.
- **Empty:** pesan “Belum ada workspace” dan tombol tambah workspace.
- **Tanpa autentikasi:** nama profil memakai placeholder netral “Pengguna” sampai `/auth/me` terintegrasi; ini bukan data workspace palsu.

## Secondary

Item menu tidak ditulis berulang di JSX. `buildNavigation(workspaceId?)` mengembalikan section General, Workspace, dan Preferences. Jika belum ada workspace, section Workspace serta tautan Today/Upcoming tidak dirender agar tidak menghasilkan URL rusak. Ikon semuanya dari `react-icons/fi`.

| Section     | Item                               |
| ----------- | ---------------------------------- |
| Pencarian   | Cari                               |
| General     | Inbox, Today, Upcoming             |
| Workspace   | All Tasks, Completed, Tags, Labels |
| Preferences | Settings                           |

`NavigationItem` memakai `NavLink`. Item aktif mendapat latar kuning, border hitam, teks tebal, dan bayangan keras, plus `aria-current="page"`. All Tasks memakai `end` agar tidak tetap aktif di child route. Item workspace di sidebar kiri tetap aktif untuk seluruh cabang `/workspace/:id`.

Saat secondary diciutkan, label tetap ada untuk screen reader lewat class `visually-hidden`, dan tooltip muncul untuk pengguna yang melihat ikon.

Workspace aktif mengikuti URL `/workspace/:workspaceId`. Di luar rute workspace, sidebar memakai workspace pertama dari daftar API sebagai konteks navigasi. Tidak ada state workspace terpilih terpisah yang dapat tidak sinkron dengan URL.

## Aksesibilitas navigasi

Kedua area memakai `nav`, daftar `ul`, dan tautan sungguhan. Tombol ikon punya `aria-label`. Tidak ada emoji sebagai menu.
