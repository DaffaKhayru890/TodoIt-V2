# Design system

Identitas visual TodoIt adalah Neo Brutalism yang tetap bisa dipakai lama: kontras kuat, border tebal, bayangan keras, dan sedikit warna aksen. Kuning adalah aksen utama. Lavender dan coral hanya dipakai untuk membedakan avatar, tombol sekunder, atau aksi tambah. Tidak ada glassmorphism, gradient, atau bayangan lembut.

## Token

Semua token ada di `src/styles/tokens.css`.

| Kelompok  | Token                                                         | Nilai awal                                                       |
| --------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Warna     | `--color-background`                                          | `#fffdf8`                                                        |
| Warna     | `--color-surface`                                             | `#ffffff`                                                        |
| Warna     | `--color-primary`                                             | `#ffe14a`                                                        |
| Warna     | `--color-secondary`                                           | `#ddd6fe`                                                        |
| Warna     | `--color-accent`                                              | `#fb923c`                                                        |
| Warna     | `--color-text`                                                | `#171717`                                                        |
| Warna     | `--color-text-muted`                                          | `#525252`                                                        |
| Warna     | `--color-border`                                              | `#171717`                                                        |
| Status    | `--color-success`, `--color-warning`, `--color-danger`        | hijau, kuning, merah muda dengan tinta gelap                     |
| Tipografi | `--text-display` sampai `--text-caption`                      | 2.5rem sampai 0.75rem                                            |
| Font      | `--font-sans`                                                 | Segoe UI, Helvetica Neue, Arial                                  |
| Spasi     | `--space-1` sampai `--space-10`                               | 0.25rem sampai 2.5rem                                            |
| Border    | `--border-default`, `--border-thick`, `--border-focus`        | 2px, 3px, dan outline fokus                                      |
| Bayangan  | `--shadow-brutal-sm`, `--shadow-brutal`, `--shadow-brutal-lg` | 2px, 4px, dan 6px                                                |
| Radius    | `--radius-none`, `--radius-sm`                                | 0 dan 4px                                                        |
| Z-index   | `--z-base` sampai `--z-tooltip`                               | konten, sticky, dropdown, popover, drawer, modal, toast, tooltip |

Bayangan besar hanya untuk modal dan kartu kosong. Tombol dan item aktif memakai bayangan kecil atau sedang.

## Tipografi

Skala yang dipakai komponen: display dan heading 1 pada judul halaman, heading 2 pada empty state, heading 3 pada nama aplikasi, body untuk teks, caption dan label untuk judul section. Font tidak diunduh dari jaringan.

## Cara menambah style

1. Tambah token bila nilainya dipakai lebih dari satu komponen.
2. Buat class semantik di stylesheet komponen, di dalam `@layer components`.
3. Impor stylesheet itu dari `src/styles/globals.css`. Tailwind 4 hanya melihat `@apply` yang masuk lewat entry CSS ini.
4. JSX hanya menulis nama class, misalnya `button button--danger`.

Variant tombol: primary, secondary, outline, danger, ghost. Ukuran: small, medium, large. Modifier: `button--full` dan `button--loading`.

`prefers-reduced-motion: reduce` mematikan animasi dan transisi non-esensial di `globals.css`, termasuk pulse skeleton.
