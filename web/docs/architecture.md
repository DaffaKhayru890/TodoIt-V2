# Arsitektur frontend

Frontend memakai pemisahan app, core, komponen, halaman, dan style. Domain bisnis akan masuk ke `src/features/` pada phase berikutnya. Phase ini tidak membuat CRUD, sidebar, atau dashboard.

## App

`src/app` memasang provider dan router.

`AppProviders` saat ini hanya membungkus `QueryProvider`. `QueryClient` dibuat lewat initializer `useState`, jadi tidak dibuat ulang setiap render.

`AppRouter` memakai `BrowserRouter`. Rute yang benar-benar terpasang:

- `/` menampilkan halaman placeholder.
- `*` menampilkan halaman tidak ditemukan.

Path `/login`, `/register`, dan `/workspace/:workspaceId` hanya tercatat di `route-paths.ts`. Mereka belum menjadi rute dan tidak ada guard autentikasi palsu.

## Core

`src/core` adalah infrastruktur.

- `env.ts` membaca dan memvalidasi `VITE_API_BASE_URL`.
- `http-client.ts` membuat request JSON ke base URL itu.
- `api-error.ts` menormalkan kegagalan menjadi `ApiError`.

Feature nantinya memanggil HTTP client lewat TanStack Query. Query key dan hook domain belum dibuat.

## Komponen dan halaman

`src/components/ui/button` adalah contoh komponen semantik. JSX memakai class `button`. Aturan visual ada di `button.css` dengan `@apply`.

`src/pages` berisi dua halaman fondasi. Halaman itu belum mengambil data server.

## Alur data yang direncanakan

1. Komponen feature memanggil hook query.
2. Hook memakai HTTP client.
3. HTTP client menambah header `Authorization` hanya jika pemanggil memberi access token.
4. Cookie refresh dikirim dengan `credentials: 'include'` ke path auth backend.
5. Respons sukses dikembalikan sebagai JSON. Respons gagal menjadi `ApiError` dengan `status` dan `code`.

Login, penyimpanan access token, dan pemanggilan `/api/v1/auth/refresh` belum diimplementasikan. `getAccessToken` adalah titik integrasi untuk phase autentikasi.

## CSS

Tailwind 4 dimuat dari `src/styles/globals.css` lewat `@import "tailwindcss"` dan plugin `@tailwindcss/vite`.

- `tokens.css` menyimpan variabel warna, font, jarak, border, radius, shadow, dan z-index awal.
- `components.css` menyimpan class bersama `app-body`.
- `utilities.css` menyimpan satu utility kustom `ink`.
- CSS komponen diimpor dari `globals.css`, bukan dari file TSX, supaya `@apply` melihat theme Tailwind.

## Testing

Vitest memakai environment jsdom. `renderWithProviders` memasang `QueryClientProvider` dan `MemoryRouter`. Tes HTTP memakai handler MSW. Detail ada di [testing-guide.md](testing-guide.md).
