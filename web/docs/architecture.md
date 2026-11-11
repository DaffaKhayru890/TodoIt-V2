# Arsitektur frontend

Frontend memakai pemisahan app, core, komponen, halaman, fitur bisnis (`src/features/`), dan style. Domain bisnis Workspace diimplementasikan pada Phase 3, Todo Management pada Phase 4, lalu productivity features pada Phase 5 dalam modul `src/features/tags/`, `src/features/labels/`, dan `src/features/reminders/`.

## App

`src/app` memasang provider dan router.

`AppProviders` membungkus `QueryProvider`. `QueryClient` dibuat lewat initializer `useState`, jadi tidak dibuat ulang setiap render.

`AppRouter` memakai `BrowserRouter`. Rute aplikasi memakai layout route `AppLayout` dan `Outlet`. Rute `/workspace/:workspaceId` terhubung ke `WorkspacePage`, rute anak `/workspace/:workspaceId/todos/:todoId` terhubung ke `TodoDetailPage`, serta `/workspace/:workspaceId/today` dan `/workspace/:workspaceId/upcoming` terhubung ke halaman productivity. Rute tag dan label memakai `/workspace/:workspaceId/tags` dan `/workspace/:workspaceId/labels`. Phase 6 menambahkan `/search` dan `/settings`.

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

### Productivity metadata (Phase 5)

- `tags/`: DTO, domain model, guard, mapper, `tagApi`, query keys, hook query/mutation, schema Zod, `TagBadge`, `TagSelector`, `TagDialog`, `DeleteTagDialog`, dan `TagsPage`.
- `labels/`: struktur yang sama dengan field `color` dan `description`, plus `LabelSelector` dan `LabelsPage`.
- `reminders/`: DTO/model/guard/mapper, `reminderApi`, query keys, `useTodoReminders`, mutation create/update/cancel, dan `ReminderSelector`.

Modul todo diperluas tanpa merombak Phase 4:

- `models/todo-priority.ts` — konfigurasi enum, label, bobot sorting.
- `models/todo-filter.ts` — state filter type-safe.
- `utils/date-format.ts`, `due-date.ts` — parsing/format lokal, status due date, rentang, grouping.
- `utils/sort-todos.ts` — sorting immutable dan natural numeric.
- `utils/filter-url.ts` — parser/serializer URL dan query plan.
- `utils/invalidate-todo-cache.ts` — invalidasi cache metadata per workspace.
- Komponen `PriorityBadge`, `PrioritySelector`, `DueDateField`, `TodoMetadata`, `TodoFilterPanel`, `TodoSortControl`, `ProductivityEmptyState`.
- Halaman `TodayPage`, `UpcomingPage`, serta perluasan `TodoDetailPage`.

Detail ada di [productivity-features.md](productivity-features.md).

### Pencarian, notifikasi, dan pagination (Phase 6)

Phase 6 menambahkan tiga modul tanpa mengubah backend:

- `search/`: model hasil, `searchApi` yang melakukan fan-out ke `todos`, `tags`, dan `labels` per workspace, query key, loader seluruh workspace, debounce, riwayat `localStorage`, highlight, navigasi keyboard, shortcut, komponen popup/trigger/content, dan halaman `/search`.
- `notifications/`: DTO, guard, mapper, `notificationApi`, query key, hook list/feed/unread/preferences, polling, Browser Notification API, bell, badge, pusat notifikasi, preferensi, dan halaman `/settings`.
- `todos/hooks/use-infinite-workspace-todos.ts`: `useInfiniteQuery` berbasis cursor backend dengan ukuran halaman 30. Sorting hanya masuk query key untuk mereset pagination, bukan dikirim ke backend.
- `todos/utils/flatten-todo-pages.ts`: penggabungan halaman, dedupe ID, dan pertahanan workspace.
- `todos/utils/workspace-scroll-key.ts` serta `hooks/scroll-position-storage.ts`/`hooks/use-scroll-restoration.ts`: penyimpanan dan pemulihan posisi scroll per workspace, filter, dan sorting.
- `hooks/use-intersection-observer.ts`: sentinel infinite scroll dengan fallback tombol.

`AppLayout` merender `SearchPopup`, `NotificationBell`, `NotificationCenter`, `useSearchShortcut`, dan `useNotificationUpdates`. `WorkspaceTodoSection` memakai infinite query, menggabungkan halaman, menerapkan filter/sorting client-side pada halaman yang dimuat, lalu memulihkan scroll. Detail ada di [global-search.md](global-search.md), [notifications.md](notifications.md), dan [cursor-pagination.md](cursor-pagination.md).

Fixture pengujian berada di `src/test/fixtures/` dan tidak diimpor oleh runtime produksi.

## Core

`src/core` adalah infrastruktur terpusat:

- `env.ts` membaca dan memvalidasi `VITE_API_BASE_URL`.
- `http-client.ts` membuat request JSON ke base URL itu dan menyediakan instance bersama `httpClient`.
- `api-error.ts` menormalkan kegagalan menjadi `ApiError`.

## Komponen dan halaman

`src/components/ui` berisi komponen design system. `src/components/layout` berisi shell dua sidebar. JSX memakai class semantik. Aturan visual ada di stylesheet komponen dan diimpor dari `globals.css`.

`src/pages` berisi halaman placeholder untuk domain yang belum dikerjakan. Khusus workspace, `src/features/workspaces/pages/WorkspacePage.tsx` sudah mengambil detail dari API. Daftar workspace di Primary Sidebar berasal dari `GET /api/v1/workspaces`, bukan fixture. Daftar tugas dan detail todo berasal dari endpoint todo backend melalui `src/features/todos/`. Halaman tag dan label berasal dari `src/features/tags/` dan `src/features/labels/`.

## Alur data

1. Komponen feature memanggil hook query/mutation TanStack Query.
2. Hook memakai `workspaceApi`, yang memakai HTTP client terpusat.
3. HTTP client menambah header `Authorization` hanya jika pemanggil memberi access token.
4. Cookie refresh dikirim dengan `credentials: 'include'` ke path auth backend.
5. Respons sukses dikembalikan sebagai JSON. Respons gagal menjadi `ApiError` dengan `status`, `code`, `message`, dan `details`.

Query key workspace memisahkan `lists()` dan `detail(id)`. Mutation menginvalidasi
`lists()` dan memperbarui atau menghapus cache detail sesuai operasi.

Query key todo selalu membawa `workspaceId`: `workspaceLists(workspaceId)` untuk daftar, `workspace(workspaceId, params)` untuk kombinasi filter, `today/upcoming/overdue(workspaceId, params)` untuk view, dan `detail(workspaceId, todoId)` untuk detail. Mutation todo hanya menginvalidasi daftar workspace terkait dan memperbarui/menghapus cache detail todo. Ini mencegah cache Workspace A tersentuh oleh operasi Workspace B.

Mutation tag/label menginvalidasi daftar metadata workspace dan cache todo workspace karena nama metadata tertanam pada representasi todo. Mutation reminder menginvalidasi daftar reminder todo serta cache todo terkait. Detail ada di [todo-api-integration.md](todo-api-integration.md) dan [productivity-features.md](productivity-features.md).

Query key Phase 6 memisahkan `search` (query + daftar workspace), `notifications` (list per filter, feed unread, unread count, preferences), dan `todoKeys.workspaceInfinite` (workspace + filter + sorting). `useGlobalSearch` meneruskan `AbortSignal` ke fan-out. `useNotificationUpdates` menginvalidasi daftar dan unread count saat ada ID notifikasi baru. Infinite query tugas memakai cursor dari respons dan tidak pernah membangun cursor sendiri.

Login, penyimpanan access token, dan pemanggilan `/api/v1/auth/refresh` belum diimplementasikan. `getAccessToken` adalah titik integrasi untuk phase autentikasi. Tanpa phase tersebut, request ke backend nyata akan ditolak 401; handler MSW dipakai untuk pengujian.

## CSS

Tailwind 4 dimuat dari `src/styles/globals.css` lewat `@import "tailwindcss"` dan plugin `@tailwindcss/vite`.

- `tokens.css` menyimpan variabel warna, font, jarak, border, radius, shadow, dan z-index awal.
- `components.css` menyimpan class bersama `app-body`.
- `utilities.css` menyimpan satu utility kustom `ink`.
- CSS komponen diimpor dari `globals.css`, bukan dari file TSX, supaya `@apply` melihat theme Tailwind.

## Testing

Vitest memakai environment jsdom. `renderWithProviders` memasang `QueryClientProvider`, `ToastProvider`, dan `MemoryRouter`. Tes HTTP memakai handler MSW. Detail ada di [testing-guide.md](testing-guide.md), [productivity-testing.md](productivity-testing.md), [global-search.md](global-search.md), [notifications.md](notifications.md), dan [cursor-pagination.md](cursor-pagination.md).
