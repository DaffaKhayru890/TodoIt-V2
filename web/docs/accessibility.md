# Aksesibilitas

## Semantik

Navigasi memakai `nav` dan `ul`. Halaman memakai satu `h1`. Tombol adalah `button`, tautan adalah `a`. Input dan textarea terhubung ke label lewat `htmlFor` dan `id`. Error memakai `role="alert"`. Checkbox punya nama dari label.

## Keyboard

Skip link “Loncat ke konten” muncul saat fokus. Komponen interaktif memakai `:focus-visible` dengan outline 3px. `NavLink` mengekspos `aria-current="page"`. Dropdown memakai `aria-expanded`, `aria-haspopup="menu"`, dan `role="menuitem"`. Tombol ciutkan dan tombol drawer memakai `aria-expanded` serta `aria-controls`.

## Dialog dan drawer

Modal merender `role="dialog"` dan `aria-modal` lewat portal. Escape menutupnya, fokus masuk ke tombol tutup, lalu kembali ke pemicu. Drawer ponsel mengikuti pola yang sama. Backdrop adalah tombol “Tutup navigasi”, tetapi jebakan Tab menjaga fokus di dalam panel. Hanya satu drawer yang terbuka.

## Kontras dan gerak

Teks utama `#171717` di atas `#fffdf8` dan `#ffffff`. Teks muted `#525252`. Status tidak hanya mengandalkan warna: badge memakai teks, item aktif memakai border dan ketebalan huruf, checkbox memakai bentuk kotak. `prefers-reduced-motion: reduce` mematikan pulse skeleton dan transisi.

Tooltip tidak menggantikan nama aksesibel. Saat sidebar diciutkan, nama tautan tetap ada di aksesibilitas tree.
