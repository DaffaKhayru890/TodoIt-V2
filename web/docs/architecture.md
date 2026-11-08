# Arsitektur frontend

Frontend memakai pemisahan app, core, komponen, halaman, fitur bisnis (`src/features/`), dan style. Domain bisnis Workspace diimplementasikan pada Phase 3, lalu Todo Management ditambahkan pada Phase 4 dalam modul terpisah `src/features/todos/`.

## App

`src/app` memasang provider dan router.

`AppProviders` membungkus `QueryProvider`. `QueryClient` dibuat lewat initializer `useState`, jadi tidak dibuat ulang setiap render.

`AppRouter` memakai `BrowserRouter`. Rute aplikasi memakai layout route `AppLayout` dan `Outlet`. Rute `/workspace/:workspaceId` terhubung ke `WorkspacePage`, dan rute anak `/workspace/:workspaceId/todos/:todoId` terhubung ke `TodoDetailPage`.

## Features (`src/features/`)

### Workspace (Phase 3)

Domain workspace diorganisasi secara modular:

- `models/`: DTO backend, Domain entities, dan Mapper.
- `api/`: Centralized workspace API service dan Query Key Factory.
- `hooks/`: TanStack Query hooks (`useWorkspaces`, `useWorkspace`, `useCreateWorkspace`, `useUpdateWorkspace`, `useArchiveWorkspace`).
- `schemas/`: Zod schemas untuk form validation (`CreateWorkspaceDialog`, `EditWorkspaceDialog`).
- `components/`: Dialog pembuatan, dialog pengubahan, dialog pengarsipan, konfirmasi discard, header detail, dan empty state.
- `pages/`: `WorkspacePage` detail view.
- `utils/`: Pemetaan detail validasi backend ke field form.

### Todo (Phase 4)

Modul todo terpisah di `src/features/todos/`:

- `models/`: DTO respons backend, domain model, runtime guard, dan mapper.
- `api/`: `todoApi` dan query key factory yang selalu membawa `workspaceId`.
- `hooks/`: Query list/detail dan mutation create/update/complete/reopen/delete.
- `schemas/`: Zod schema field bersama untuk create dan edit.
- `components/`: `WorkspaceTodoSection`, `TodoList`, `TodoItem`, empty state, form fields, dan tiga dialog.
- `pages/`: `TodoDetailPage`.
- `utils/`: Pemetaan `VALIDATION_ERROR` ke field todo.

`WorkspacePage` hanya merender `WorkspaceTodoSection`; seluruh state query, dialog, dan feedback todo tetap berada di fitur todos. Detail arsitektur ada di [todo-management.md](todo-management.md) dan [todo-components.md](todo-components.md).

Fixture pengujian berada di `src/test/fixtures/` dan tidak diimpor oleh runtime produksi.

## Core

`src/core` adalah infrastruktur terpusat:

- `env.ts` membaca dan memvalidasi `VITE_API_BASE_URL`.
- `http-client.ts` membuat request JSON ke base URL itu dan menyediakan instance bersama `httpClient`.
- `api-error.ts` menormalkan kegagalan menjadi `ApiError`.

## Komponen dan halaman

`src/components/ui` berisi komponen design system. `src/components/layout` berisi shell dua sidebar. JSX memakai class semantik. Aturan visual ada di stylesheet komponen dan diimpor dari `globals.css`.

`src/pages` berisi halaman placeholder untuk domain yang belum dikerjakan (tag, label, pengaturan, dan sejenisnya). Halaman tersebut belum mengambil data server. Khusus workspace, `src/features/workspaces/pages/WorkspacePage.tsx` sudah mengambil detail dari API. Daftar workspace di Primary Sidebar berasal dari `GET /api/v1/workspaces`, bukan fixture. Daftar tugas dan detail todo berasal dari endpoint todo backend melalui `src/features/todos/`.

## Alur data

1. Komponen feature memanggil hook query/mutation TanStack Query.
2. Hook memakai `workspaceApi`, yang memakai HTTP client terpusat.
3. HTTP client menambah header `Authorization` hanya jika pemanggil memberi access token.
4. Cookie refresh dikirim dengan `credentials: 'include'` ke path auth backend.
5. Respons sukses dikembalikan sebagai JSON. Respons gagal menjadi `ApiError` dengan `status`, `code`, `message`, dan `details`.

Query key workspace memisahkan `lists()` dan `detail(id)`. Mutation menginvalidasi
`lists()` dan memperbarui atau menghapus cache detail sesuai operasi.

Query key todo selalu membawa `workspaceId`: `workspaceLists(workspaceId)` untuk daftar dan `detail(workspaceId, todoId)` untuk detail. Mutation todo hanya menginvalidasi daftar workspace terkait dan memperbarui/menghapus cache detail todo. Ini mencegah cache Workspace A tersentuh oleh operasi Workspace B. Detail ada di [todo-api-integration.md](todo-api-integration.md).

Login, penyimpanan access token, dan pemanggilan `/api/v1/auth/refresh` belum diimplementasikan. `getAccessToken` adalah titik integrasi untuk phase autentikasi. Tanpa phase tersebut, request ke backend nyata akan ditolak 401; handler MSW dipakai untuk pengujian.

## CSS

Tailwind 4 dimuat dari `src/styles/globals.css` lewat `@import "tailwindcss"` dan plugin `@tailwindcss/vite`.

- `tokens.css` menyimpan variabel warna, font, jarak, border, radius, shadow, dan z-index awal.
- `components.css` menyimpan class bersama `app-body`.
- `utilities.css` menyimpan satu utility kustom `ink`.
- CSS komponen diimpor dari `globals.css`, bukan dari file TSX, supaya `@apply` melihat theme Tailwind.

## Testing

Vitest memakai environment jsdom. `renderWithProviders` memasang `QueryClientProvider` dan `MemoryRouter`. Tes HTTP memakai handler MSW. Detail ada di [testing-guide.md](testing-guide.md).
