# Responsive design

Pendekatan dimulai dari layar sempit. Layout tidak hanya mengecilkan tiga kolom desktop.

| Viewport                                                     | Perilaku                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1024px ke atas, termasuk laptop 1366, desktop 1440, dan 1920 | Dua sidebar terlihat. Keduanya bisa diciutkan. Konten memakai sisa lebar.                               |
| 768–1023, tablet portrait dan landscape                      | Bar atas. Sidebar menjadi drawer. Konten selebar viewport.                                              |
| 390 dan 320                                                  | Drawer selebar `min(20rem, 100vw - 1rem)` agar tidak melebihi layar. Target sentuh tombol ikon 2.75rem. |

Padding halaman naik di `min-width: 1024px`. Teks panjang memakai `overflow-wrap`. Grid konten memakai `minmax(0, 1fr)` supaya tidak memaksa scroll horizontal.

Scroll sidebar dan scroll konten terpisah. Drawer memakai `position: fixed` dan backdrop. Transisi tidak diandalkan untuk memahami state: panel benar-benar tersembunyi lewat atribut `hidden` saat tertutup.

Pengukuran CSS yang nyata diperiksa di browser, bukan hanya di JSDOM. Tes unit memeriksa state buka, tutup, Escape, dan collapse.
