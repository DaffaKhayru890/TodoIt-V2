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

Interaksi memakai `@testing-library/user-event`. Tes router mengklik tautan dan memeriksa heading halaman tidak ditemukan. Karena daftar workspace dimuat secara asinkron, tes yang membutuhkan tautan workspace menunggu `findByRole` sebelum berinteraksi.

## MSW

Handler ditulis dengan `http` dan `HttpResponse` dari `msw`. Mereka didaftarkan lewat `setupServer` di `src/test/mocks/server.ts`.

Runtime tes adalah Bun. Interceptor jaringan MSW 3 mencoba menambal `tls.TLSSocket`, dan Bun tidak menyediakan nilai itu, sehingga `server.listen()` tidak menangkap `fetch`. Setup tes menjembatani `globalThis.fetch` ke `getResponse` dari MSW. Handler, pencocokan URL, dan `HttpResponse` tetap milik MSW. Request yang tidak punya handler ditolak.

Tes HTTP client mencakup respons JSON sukses, error API, kegagalan jaringan lewat `HttpResponse.error()`, JSON tidak valid, penggabungan base URL, header Bearer, dan serialisasi body.

## Komponen & Fitur Phase 3 (Workspace)

Pengujian Phase 3 mencakup:

- **Model & Mapper Tests (`workspace.mapper.test.ts`):** Transformasi DTO ke Entity domain, Date parsing, dan mark derivation.
- **Form Schemas (`workspace-schemas.test.ts`):** Validasi Zod nama dan deskripsi.
- **Validation Mapping (`utils/api-validation.test.ts`):** Pemetaan `error.details` backend ke field form.
- **API Service Tests (`workspace.api.test.ts`):** Pemanggilan endpoint, parameter, normalisasi error 404/403, dan detail validasi 422.
- **Query & Mutation Hooks (`workspace-hooks.test.tsx`):** `useWorkspaces`, `useWorkspace`, `useCreateWorkspace`, `useUpdateWorkspace`, `useArchiveWorkspace`, error 401 tanpa retry berulang, invalidasi `lists()`, pengisian `detail(id)`, dan `removeQueries` setelah archive.
- **Component Tests:** `CreateWorkspaceDialog` (termasuk dirty close dan detail validasi), `EditWorkspaceDialog` (termasuk dirty close), `ArchiveWorkspaceDialog`, `DiscardChanges`, `WorkspaceHeader` (termasuk non-owner), `WorkspaceEmptyState`, `WorkspacePage` (termasuk 403/404 dan non-owner), `PrimarySidebar` (loading/error/cache/empty), dan `WorkspaceItem`.
- **Integration Workflow Tests (`workspace-workflows.test.tsx`):** Alur penuh pembuatan workspace, pengubahan workspace, dan pengarsipan workspace beserta navigasi router.

Fixture bersama berada di `src/test/fixtures/workspaces.ts`. File itu tidak boleh diimpor dari kode produksi. ID fixture memakai bentuk UUID agar konsisten dengan schema backend.

Hasil akhir Phase 3: 40 file test, 129 test lulus, coverage 88,84% statements / 84,30% branches / 92,09% functions / 88,63% lines.

## Komponen & Fitur Phase 4 (Todo)

Pengujian Phase 4 menambahkan:

- **Model, guard, mapper (`models/`):** Pemetaan DTO ke domain, validasi bentuk respons, helper status, dan normalisasi request.
- **Schema (`schemas/todo-schemas.test.ts`):** Batas judul 200 dan deskripsi 5000 karakter.
- **Validasi API (`utils/api-validation.test.ts`):** Pemetaan detail `VALIDATION_ERROR` ke field todo.
- **API service (`api/todo.api.test.ts`):** List dengan `limit`/`cursor`, detail, create, update, complete, delete, error 401/404/403/422, respons rusak, dan error jaringan.
- **Query & Mutation Hooks (`hooks/todo-hooks.test.tsx`):** List/detail, seluruh mutation, invalidasi list per workspace, pengisian/penghapusan cache detail, dan isolasi cache antar workspace.
- **Component Tests:** `TodoFormFields`, `TodoItem`, `TodoEmptyState`, `TodoList`, `CreateTodoDialog`, `EditTodoDialog`, `DeleteTodoDialog`, `WorkspaceTodoSection`, dan `TodoDetailPage`.
- **Integration Workflow Tests (`tests/todo-workflows.test.tsx`):** Workflow A (create), B (edit), C (complete + reopen), D (detail + delete + redirect), E (isolasi antar workspace), F (detail 404 + kembali).

Fixture todo berada di `src/test/fixtures/todos.ts`. Handler default MSW menyediakan daftar todo kosong agar halaman workspace Phase 3 tetap dapat dirender; test yang membutuhkan data mendaftarkan handler sendiri.

Hasil akhir Phase 4: 56 file test, 239 test lulus, coverage 90,98% statements / 86,30% branches / 93,46% functions / 90,96% lines. Detail ada di [todo-testing.md](todo-testing.md).

## Komponen & Fitur Phase 5 (Productivity)

Phase 5 menambahkan:

- **Tag dan label:** model/mapper/guard, API service, hook query/mutation, schema Zod, badge, selector, dialog create/edit/delete, dan halaman manajemen beserta test permission.
- **Priority:** konfigurasi enum, badge, selector, bobot sorting, dan integrasi form.
- **Due date dan timezone:** parsing `datetime-local`, round-trip tanggal kalender, format lokal, status due date, rentang hari, grouping, dan test dengan waktu injeksi.
- **Reminder:** model/guard/mapper, API, hook, selector, serta validasi reminder memerlukan due date.
- **Filter:** model state, parser/serializer URL, query plan, client filter, panel filter, chip, dan hapus semua.
- **Sorting:** utility immutable, natural numeric via `Intl.Collator`, prioritas berbobot, null due date di akhir, dan kontrol sorting.
- **Halaman:** `TodayPage`, `UpcomingPage`, perluasan `TodoDetailPage`, dan `WorkspaceTodoSection` berbasis URL.
- **Workflow A–F:** create dengan metadata, edit metadata, Today, Upcoming, filter gabungan, dan sorting.

Hasil akhir Phase 5: 96 file test, 523 test lulus, coverage 91,80% statements / 87,67% branches / 92,74% functions / 91,65% lines. Detail ada di [productivity-testing.md](productivity-testing.md).

`configure({ asyncUtilTimeout: 5000 })` dipasang di setup karena suite berjalan paralel; ini memberi ruang bagi query async sebelum assertion, tanpa mengubah perilaku aplikasi.

`vite.config.ts` membatasi `maxWorkers: 6` dan memasang `testTimeout: 20_000`. Dengan puluhan file jsdom, menjalankan semua worker sekaligus membuat kontensi CPU dan memicu timeout palsu pada test yang sebenarnya cepat. Batas ini hanya mengatur eksekusi test, bukan menonaktifkan pemeriksaan.

## Konvensi

- Satu perilaku per tes.
- Assertion memakai role atau teks yang dilihat pengguna untuk UI.
- Tidak memakai snapshot sebagai pengganti assertion perilaku.
