# Productivity features

Phase 5 memperluas Todo Management dengan metadata produktivitas, tampilan waktu, filter, dan sorting. Seluruh data tetap berasal dari API backend. Tidak ada mock data produksi dan backend tidak diubah.

## Ringkasan fitur

| Fitur                    | Status                      | Sumber data                                                                              |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- |
| Tag workspace            | Tersedia                    | `GET/POST/PATCH/DELETE /api/v1/workspaces/:workspaceId/tags`                             |
| Assignment tag ke todo   | Tersedia                    | `PUT /todos/:todoId/tags`, `POST/DELETE /todos/:todoId/tags/:tagId`                      |
| Label workspace          | Tersedia                    | `GET/POST/PATCH/DELETE /api/v1/workspaces/:workspaceId/labels`                           |
| Assignment label ke todo | Tersedia                    | `PUT/DELETE /todos/:todoId/label`                                                        |
| Priority                 | Tersedia sebagai field todo | `priority` pada create/update                                                            |
| Due date                 | Tersedia sebagai field todo | `dueAt` pada create/update                                                               |
| Reminder                 | Tersedia sebagai resource   | `/todos/:todoId/reminders`                                                               |
| Today view               | Tersedia                    | `GET /todos/today`                                                                       |
| Upcoming view            | Tersedia                    | `GET /todos/upcoming`                                                                    |
| Overdue                  | Tersedia                    | `GET /todos/overdue` dan filter `due=overdue`                                            |
| Filter server-side       | Sebagian                    | `status`, `priority`, `dueFrom/dueTo`, `createdFrom/createdTo`, `q`, `tagIds`, `labelId` |
| Filter client-side       | Terbatas                    | `active`, `no-date`, dan penyaringan overdue aktif                                       |
| Sorting                  | Tidak tersedia di backend   | Client-side pada halaman yang dimuat                                                     |
| Pagination lanjutan      | Tersedia sejak Phase 6      | Cursor pagination dan infinite scroll                                                    |

## Hubungan dengan Todo Management

Todo tetap merupakan aggregate utama. Tag, label, priority, due date, dan reminder bukan todo terpisah:

- **Tag** dan **label** adalah resource workspace yang direferensikan todo.
- **Priority** dan **due date** adalah kolom todo yang dikirim melalui create/update.
- **Reminder** adalah resource anak todo dengan `todoId` dan siklus hidup sendiri.

Karena itu, membuat todo dengan metadata dilakukan bertahap: todo dibuat lebih dahulu, lalu tag, label, dan reminder disimpan. Jika salah satu langkah metadata gagal, todo inti tetap ada dan pengguna menerima peringatan parsial. Frontend tidak pernah melaporkan sukses penuh jika metadata gagal.

## Arsitektur fitur

```text
src/features/
├── todos/
│   ├── models/       todo.dto.ts, todo.model.ts, todo-priority.ts, todo-filter.ts
│   ├── api/          todo.api.ts, todo.query-keys.ts
│   ├── hooks/        list/detail, today/upcoming/overdue, mutation
│   ├── schemas/      create-todo, update-todo, todo-fields
│   ├── components/   priority, due date, metadata, filter, sort, dialog
│   ├── pages/        TodayPage, UpcomingPage, TodoDetailPage
│   ├── utils/        date-format, due-date, sort-todos, filter-url, cache
│   └── tests/        workflow A–F
├── tags/             model, mapper, guard, API, hooks, schema, UI, page
├── labels/           model, mapper, guard, API, hooks, schema, UI, page
└── reminders/        model, mapper, guard, API, hooks, UI selector
```

Setiap modul metadata memiliki `api/`, `hooks/`, `models/`, dan komponen sendiri. Barrel `index.ts` mengekspor permukaan publik agar import tidak menembus file internal.

## Alur data

1. Halaman membaca `workspaceId` dari route.
2. Filter dan sorting dibaca dari URL melalui `parseTodoFilter` dan `parseTodoSort`.
3. `toTodoListQueryPlan` menerjemahkan filter ke parameter API dan menandai filter yang harus diselesaikan di client.
4. `useWorkspaceTodos` / `useTodayTodos` / `useUpcomingTodos` menjalankan query dengan key yang memuat `workspaceId` dan parameter.
5. `todoApi` memanggil endpoint backend melalui HTTP client terpusat.
6. Guard memvalidasi bentuk respons, mapper mengubah DTO menjadi domain model (`Date` asli, bukan string).
7. Komponen memfilter dan mengurutkan salinan array; cache tidak pernah dimutasi.
8. Mutation menginvalidasi daftar workspace terkait dan memperbarui atau menghapus cache detail.

## Integrasi TanStack Query

Query key todo selalu membawa `workspaceId`:

- `todoKeys.workspaceLists(workspaceId)` mencakup daftar dan seluruh view.
- `todoKeys.workspace(workspaceId, params)` memisahkan cache per kombinasi filter.
- `todoKeys.today/upcoming/overdue(workspaceId, params)` memisahkan view.
- `todoKeys.detail(workspaceId, todoId)` menyimpan detail.

Mutation todo menginvalidasi daftar workspace dan detail terkait. Mutation tag/label juga menginvalidasi cache todo workspace karena nama tag/label tertanam pada representasi todo. Mutation reminder menginvalidasi daftar reminder todo serta cache todo terkait.

Tidak ada invalidasi global `queryClient.clear()`.

## Hasil review Phase 1–4

- HTTP client, environment, provider, router, error normalization, dan testing infrastructure dipakai ulang tanpa perubahan.
- Design system Neo Brutalism, Modal, Popover, Button, Input, Select, Checkbox, Badge, Skeleton, EmptyState, dan Toast tetap menjadi dasar UI.
- Workspace context dan permission tetap dipertahankan.
- Todo CRUD, completion, reopen, delete, dan detail tidak diubah perilakunya; Phase 5 hanya memperluas form, item, dan detail.

## Batasan

- Sorting tidak didukung backend, sehingga hanya berlaku pada data yang sudah dimuat.
- Filter `active` dan `no-date` tidak dapat diekspresikan API; hasilnya dibatasi pada halaman yang sudah dimuat.
- Reminder hanya menyimpan konfigurasi. Pengiriman bergantung pada Notification Engine/worker backend.
- Pencarian global, notification center, dan cursor pagination ditambahkan pada Phase 6; fitur kolaborasi tetap berada di luar cakupan.
