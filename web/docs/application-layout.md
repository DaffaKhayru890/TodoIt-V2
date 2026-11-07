# Application layout

Shell ada di `src/components/layout/app-layout`. Tiga area desktop:

1. Primary sidebar, daftar workspace contoh.
2. Secondary sidebar, navigasi aplikasi.
3. Main content, `Outlet` React Router.

Grid memakai tinggi `100dvh`. Header dan footer sidebar tidak ikut scroll. Daftar di tengah memakai `overflow: auto` dan `overscroll-behavior: contain`, jadi scroll menu tidak menyeret halaman di belakangnya. Main content punya scroll sendiri.

## Collapse

Di lebar 1024px ke atas, setiap sidebar punya tombol ciutkan dengan `aria-expanded` dan `aria-controls`. Primary menjadi kolom sempit berisi mark. Secondary menjadi ikon, dengan tooltip saat hover atau fokus. Preferensi disimpan di `localStorage` lewat `sidebar-preference.ts`. Nilai yang bukan boolean diabaikan. Kegagalan storage ditelan karena ini hanya preferensi UI.

## Mobile dan tablet

Di bawah 1024px grid berubah menjadi bar atas dan konten. Primary dan secondary menjadi panel `position: fixed`. Bar punya dua tombol: buka workspace dan buka navigasi. Membuka satu drawer menutup yang lain.

`MobileNavigationDrawer` merender backdrop. Escape, klik backdrop, dan tombol tutup menutup drawer. Fokus pindah ke elemen pertama di panel, lalu dikembalikan ke tombol pemicu. `body` tidak di-scroll selama dialog terbuka.

Tidak ada data workspace yang ditulis dari shell ini.
