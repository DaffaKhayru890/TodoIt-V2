# Keputusan teknis

## Feature-based architecture

Folder `app`, `core`, `components`, `pages`, dan `styles` memisahkan inisialisasi, infrastruktur, dan tampilan. Domain seperti workspace dan todo akan menjadi folder di `src/features` ketika diimplementasikan. Membuat folder itu sekarang hanya menambah direktori kosong, jadi belum dibuat.

## TanStack Query

Server state akan di-cache di luar state form dan state UI lokal. Phase ini hanya memasang `QueryClient` dengan `retry: 1`, `staleTime` 30 detik, dan `refetchOnWindowFocus: false`. Angka itu mudah diubah per query nanti.

## Tailwind CSS 4

Versi yang terpasang adalah 4.3.5 bersama `@tailwindcss/vite`. Konfigurasinya adalah plugin Vite dan `@import "tailwindcss"`, bukan file `tailwind.config.js` versi 3. `@apply` dipakai di stylesheet semantik. Class utility panjang tidak ditulis di TSX. CSS komponen diimpor dari `globals.css` karena Tailwind 4 tidak mengenali utility bila file CSS komponen menjadi entry terpisah dari TSX.

Token visual lengkap untuk Neo Brutalism ada di `tokens.css`. Tailwind tetap v4. Overlay dropdown, popover, modal, dan drawer dibuat sendiri agar tidak menambah Radix hanya untuk beberapa interaksi. Fokus, Escape, dan klik luar ditangani di hook kecil.

## HTTP client

Backend memakai access token Bearer dan refresh token cookie HttpOnly. Client mengirim `credentials: "include"` dan header Bearer hanya bila ada token. Bentuk error mengikuti `{ error: { code, message, requestId } }`. Login dan refresh belum dibuat supaya phase ini tidak mengarang alur session.

## Package manager

Frontend memakai Bun, sama dengan backend, tetapi punya `package.json` dan `bun.lock` sendiri di `web/`. Root `package.json` tetap milik backend.

## Dependency

Versi yang terpasang dipilih dari resolver Bun pada saat instalasi, bukan dari konfigurasi lama:

- react dan react-dom 19.3.1
- react-router 8.5.1, package `react-router`, API `BrowserRouter`, `Routes`, `Route`, `Link`, `MemoryRouter`
- @tanstack/react-query 5.107.1
- react-hook-form 7.91.0, zod 4.6.7, @hookform/resolvers 7.0.3
- react-icons 5.7.0
- vite 8.3.6, @vitejs/plugin-react 6.2.1, typescript 6.0.3
- tailwindcss 4.3.5
- vitest 5.1.0, Testing Library React 16.3.3, user-event 14.6.8, jest-dom 7.0.1, jsdom 31
- msw 3.0.4
- eslint 10.14.0, typescript-eslint 8.72.1, eslint-plugin-react-hooks 7, eslint-plugin-react-refresh 0.5, eslint-plugin-jsx-a11y 6.10, prettier 3.9

React Hook Form dan Zod terpasang agar phase form tidak mengganti resolver. Belum ada form.

TypeScript frontend memakai 6.0.3. Resolver sempat memilih 7.0.2, tetapi `typescript-eslint` 8.72 menolak TypeScript 7, jadi compiler diturunkan ke 6 agar typecheck dan ESLint memakai parser yang sama. Backend tetap pada TypeScript 5.9 di root.

## Shell dan data contoh

Dua sidebar memakai state React di `AppLayout`. Preferensi ciutkan disimpan di `localStorage` dengan kunci `todoit.sidebar` dan hanya berisi dua boolean. Workspace serta nama pengguna adalah fixture di `workspace-fixtures.ts`, bukan hasil API.

Breakpoint compact adalah `max-width: 1023px`. Di bawah itu kedua sidebar menjadi drawer, dan hanya satu drawer yang dibuka.

## Trade-off

MSW 3 di Bun tidak bisa menambal socket TLS. Tes tetap memakai handler MSW, dengan adapter `fetch` yang memanggil `getResponse`. Trade-off-nya: tes tidak membuktikan interceptor socket Node, tetapi membuktikan pencocokan handler, status HTTP, dan body.

React Router 8 dipakai karena itulah versi stabil yang di-resolve. API yang dipakai (`BrowserRouter`, `Routes`, `Route`) ada pada paket itu. Tidak ada downgrade ke v6.
