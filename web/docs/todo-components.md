# Komponen Todo (Phase 4)

Dokumen ini menjelaskan struktur komponen fitur todo, tanggung jawabnya, props utama, serta keputusan UI/aksesibilitas.

Fitur berada di `src/features/todos/`. Komponen design system Phase 2 dipakai ulang; tidak ada duplikasi `Button`, `Modal`, `Input`, atau `Textarea`.

---

## A. Struktur Folder

```text
src/features/todos/
├── api/
│   ├── todo.api.ts
│   ├── todo.api.test.ts
│   └── todo.query-keys.ts
├── components/
│   ├── create-todo-dialog/
│   ├── delete-todo-dialog/
│   ├── edit-todo-dialog/
│   ├── todo-empty-state/
│   ├── todo-form-fields/
│   ├── todo-item/
│   ├── todo-list/
│   └── workspace-todo-section/
├── hooks/
│   ├── use-workspace-todos.ts
│   ├── use-todo.ts
│   ├── use-create-todo.ts
│   ├── use-update-todo.ts
│   ├── use-complete-todo.ts
│   ├── use-reopen-todo.ts
│   ├── use-delete-todo.ts
│   ├── todo-query-options.ts
│   └── todo-hooks.test.tsx
├── models/
├── pages/
│   ├── TodoDetailPage.tsx
│   ├── todo-detail-page.css
│   └── TodoDetailPage.test.tsx
├── schemas/
├── tests/
│   └── todo-workflows.test.tsx
├── utils/
└── index.ts
```

CSS berada di samping komponennya dan diimpor dari `src/styles/globals.css`, bukan dari TSX.

---

## B. Pohon Komponen

```text
WorkspacePage
└── WorkspaceTodoSection
    ├── TodoList
    │   ├── TodoEmptyState
    │   └── TodoItem (berulang)
    ├── CreateTodoDialog
    │   └── TodoFormFields
    ├── EditTodoDialog
    │   └── TodoFormFields
    └── DeleteTodoDialog
```

```text
TodoDetailPage
├── EditTodoDialog
│   └── TodoFormFields
└── DeleteTodoDialog
```

---

## C. Tanggung Jawab Komponen

### `WorkspaceTodoSection`

Menghubungkan konteks workspace dengan fitur todo. Komponen ini memiliki query daftar, mutation status, state dialog, dan feedback.

Props:

```ts
interface WorkspaceTodoSectionProps {
  workspaceId: string;
  workspaceName: string;
}
```

Perilaku:

- Mengambil daftar lewat `useWorkspaceTodos`.
- Menyimpan `updatingTodoId` agar hanya satu item diproses dan checkbox item tersebut dinonaktifkan.
- Menampilkan feedback sukses/gagal inline dengan `role="status"` atau `role="alert"`.
- Membuka dialog create/edit/delete.
- `WorkspacePage` memberi `key={workspace.id}` supaya state lokal tidak bocor antar workspace.

### `TodoList`

Murni presentasional: menerima data dan callback, tidak memanggil API.

Props utama:

```ts
interface TodoListProps {
  workspaceId: string;
  todos: readonly Todo[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  hasMore?: boolean;
  updatingTodoId?: string | null;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
}
```

Perilaku:

- Skeleton saat loading awal.
- Empty state bila daftar kosong.
- Error penuh bila gagal tanpa data; error inline bila data lama masih ada.
- Section Aktif selalu tampil; section Selesai hanya tampil jika ada item selesai.
- Section Selesai dapat diciutkan/dibentangkan dengan `aria-expanded` dan `aria-controls`.
- Angka jumlah item memakai elemen visual terpisah.
- Bila `hasMore`, tampil catatan pagination.

### `TodoItem`

Menampilkan satu todo.

Props:

```ts
interface TodoItemProps {
  workspaceId: string;
  todo: Todo;
  onToggleComplete: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  isUpdating?: boolean;
}
```

Perilaku dan aksesibilitas:

- Checkbox memakai `Checkbox` dengan label tersembunyi secara visual (`hideLabel`), tetapi nama aksesibel tetap terbaca screen reader.
- Label berubah sesuai status: “Tandai tugas … sebagai selesai” atau “Buka kembali tugas …”.
- Judul adalah tautan ke halaman detail.
- Todo selesai memakai judul dicoret dan warna muted.
- Menu aksi memakai `Dropdown` dengan `ariaLabel` unik per todo (“Aksi untuk …”).
- `isUpdating` menonaktifkan checkbox dan menandai artikel `aria-busy`.

### `TodoFormFields`

Field bersama untuk create dan edit:

- `Input` judul, wajib, `maxLength=200`.
- `Textarea` deskripsi, opsional, `maxLength=5000`, dengan hint.

Props menerima `register` dan `errors` dari React Hook Form sehingga aturan validasi hanya didefinisikan sekali.

### `CreateTodoDialog`

- Modal berjudul “Buat Tugas Baru”.
- Menampilkan konteks workspace.
- Validasi Zod + React Hook Form.
- Mencegah submit ganda saat `isSubmitting` atau mutation pending.
- Memetakan `VALIDATION_ERROR` ke field.
- Menampilkan error jaringan di atas form dan mempertahankan isian.
- Menampilkan `DiscardChanges` bila form kotor ditutup.
- Reset state saat ditutup.

### `EditTodoDialog`

- Modal berjudul “Ubah Tugas”.
- Memuat nilai awal dari `todo` saat dibuka.
- Tombol simpan nonaktif sampai ada perubahan.
- Hanya mengirim field yang berubah.
- Jika perubahan hanya berupa spasi, dialog ditutup tanpa request.
- Memakai aturan validasi dan penanganan error yang sama dengan create.

### `DeleteTodoDialog`

- Modal berjudul “Hapus Tugas”.
- Menyebut judul todo dan menjelaskan dampak soft delete.
- Tidak dapat ditutup saat request berjalan.
- Error backend ditampilkan inline dan dialog tetap terbuka.

### `TodoEmptyState`

- Memakai `EmptyState` Phase 2 dengan ilustrasi SVG lokal.
- Judul “Belum ada tugas!”.
- Aksi “Buat tugas pertama”.
- Mendukung `disabled` bila diperlukan.

### `TodoDetailPage`

- Rute `/workspace/:workspaceId/todos/:todoId`.
- Mengambil detail todo dan nama workspace secara paralel.
- Skeleton saat loading.
- State not found/access denied/error dengan aksi yang sesuai.
- Memvalidasi bahwa `todo.workspaceId` sama dengan parameter rute.
- Aksi selesai/reopen, ubah, dan hapus.
- Setelah hapus, navigasi `replace` ke workspace.
- `useDocumentTitle` memakai judul todo.

---

## D. Hook

| Hook                | Jenis    | Tugas                                              |
| ------------------- | -------- | -------------------------------------------------- |
| `useWorkspaceTodos` | query    | Daftar todo halaman pertama (`limit=100`)          |
| `useTodo`           | query    | Detail todo                                        |
| `useCreateTodo`     | mutation | Create + isi cache detail + invalidate list        |
| `useUpdateTodo`     | mutation | Update + perbarui cache detail + invalidate list   |
| `useCompleteTodo`   | mutation | Complete + perbarui cache detail + invalidate list |
| `useReopenTodo`     | mutation | PATCH status `todo` + invalidate                   |
| `useDeleteTodo`     | mutation | Delete + hapus cache detail + invalidate list      |

Semua mutation menerima `workspaceId` secara eksplisit agar tidak bergantung pada state global.

---

## E. CSS dan Neo Brutalism

Stylesheet fitur:

- `todo-form-fields.css` — layout form dan pesan error.
- `create-todo-dialog.css` — kartu konteks workspace.
- `edit-todo-dialog.css` — catatan dialog edit.
- `delete-todo-dialog.css` — penekanan judul dan peringatan.
- `todo-item.css` — kartu item, status selesai, menu aksi.
- `todo-list.css` — section, skeleton, error, pagination.
- `todo-empty-state.css` — wrapper dashed.
- `workspace-todo-section.css` — header section dan feedback.
- `todo-detail-page.css` — header, panel, metadata.

Prinsip yang dijaga:

- Border tebal dan shadow tegas sesuai token Phase 2.
- Class semantik, bukan kumpulan utility di TSX.
- Warna memakai variabel token (`--color-*`, `--space-*`, `--text-*`).
- Layout responsif: header/aksi menumpuk di layar kecil, tombol menjadi penuh.

---

## F. Aksesibilitas

- Setiap dialog memakai `Modal` dengan `role="dialog"`, judul, focus trap, Escape, dan pengembalian fokus.
- Checkbox memiliki nama aksesibel meskipun label visual disembunyikan.
- Tombol ikon memakai `aria-label`.
- Menu aksi memakai `role="menu"`/`menuitem` dan menutup setelah dipilih.
- Feedback memakai `role="status"` untuk sukses dan `role="alert"` untuk error.
- Section daftar memakai heading dan `aria-label`.
- Item yang sedang diproses memakai `aria-busy`.
- Tautan dan tombol memiliki focus-visible outline.

---

## G. Batasan Komponen

- Belum ada toast global; feedback bersifat lokal.
- Belum ada kontrol priority, due date, tag, atau label.
- Belum ada filter/sort/search.
- Pagination berikutnya belum dimuat; hanya catatan `hasMore`.
- Todo `cancelled` tidak dirender.
