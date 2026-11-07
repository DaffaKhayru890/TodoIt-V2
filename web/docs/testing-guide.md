# Panduan testing

## Vitest

Konfigurasi tes ada di `vite.config.ts`. Environment adalah jsdom. Alias `@` menunjuk ke `src`. `VITE_API_BASE_URL` di tes diisi `http://localhost:4000`.

Perintah:

```bash
bun run test:run
bun run test:coverage
```

Coverage memakai `@vitest/coverage-v8`. File tes, setup, dan `main.tsx` dikeluarkan dari hitungan.

## React Testing Library

`src/test/setup.ts` memanggil `cleanup()` setiap tes karena Vitest tidak memasang cleanup otomatis saat globals dimatikan.

`renderWithProviders` membungkus komponen dengan `QueryClientProvider` baru dan `MemoryRouter`. Query client tes terpisah dari client aplikasi.

Interaksi memakai `@testing-library/user-event`. Tes router mengklik tautan dan memeriksa heading halaman tidak ditemukan.

## MSW

Handler ditulis dengan `http` dan `HttpResponse` dari `msw`. Mereka didaftarkan lewat `setupServer` di `src/test/mocks/server.ts`.

Runtime tes adalah Bun. Interceptor jaringan MSW 3 mencoba menambal `tls.TLSSocket`, dan Bun tidak menyediakan nilai itu, sehingga `server.listen()` tidak menangkap `fetch`. Setup tes menjembatani `globalThis.fetch` ke `getResponse` dari MSW. Handler, pencocokan URL, dan `HttpResponse` tetap milik MSW. Request yang tidak punya handler ditolak.

Tes HTTP client mencakup respons JSON sukses, error API, kegagalan jaringan lewat `HttpResponse.error()`, JSON tidak valid, penggabungan base URL, header Bearer, dan serialisasi body.

## Komponen Phase 2

Setiap komponen UI dan layout baru punya tes perilaku: variant, klik, disabled, keyboard, Escape, dan state aktif navigasi. Viewport compact disimulasikan dengan `mockViewport` karena JSDOM tidak mengukur CSS. Pemeriksaan visual responsive dilakukan di browser.

## Konvensi

- Satu perilaku per tes.
- Assertion memakai role atau teks yang dilihat pengguna untuk UI.
- Tidak memakai snapshot sebagai pengganti assertion perilaku.
