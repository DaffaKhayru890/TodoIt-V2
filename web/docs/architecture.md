# Arsitektur frontend

Frontend memakai pemisahan app, core, komponen, halaman, dan style. Domain bisnis akan masuk ke `src/features/` pada phase berikutnya. Phase 2 membangun shell visual, bukan CRUD.

## App

`src/app` memasang provider dan router.

`AppProviders` saat ini hanya membungkus `QueryProvider`. `QueryClient` dibuat lewat initializer `useState`, jadi tidak dibuat ulang setiap render.

`AppRouter` memakai `BrowserRouter`. Rute aplikasi memakai layout route `AppLayout` dan `Outlet`. Detail ada di [routing.md](routing.md). Tidak ada guard autentikasi yang memeriksa boolean palsu.

## Core

`src/core` adalah infrastruktur.

- `env.ts` membaca dan memvalidasi `VITE_API_BASE_URL`.
- `http-client.ts` membuat request JSON ke base URL itu.
- `api-error.ts` menormalkan kegagalan menjadi `ApiError`.

Feature nantinya memanggil HTTP client lewat TanStack Query. Query key dan hook domain belum dibuat.

## Komponen dan halaman

`src/components/ui` berisi komponen design system. `src/components/layout` berisi shell dua sidebar. JSX memakai class semantik. Aturan visual ada di stylesheet komponen dan diimpor dari `globals.css`.

`src/pages` berisi halaman placeholder. Halaman itu belum mengambil data server. Workspace di sidebar adalah fixture visual.

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
