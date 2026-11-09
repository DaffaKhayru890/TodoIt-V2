# Testing Todo (Phase 4)

Dokumen ini menjelaskan cakupan pengujian fitur todo, teknik yang dipakai, dan hasil validasi Phase 4.

---

## A. Perintah

Dijalankan dari `web/`:

```bash
bun run test:run
bun run test:coverage
```

Validasi penuh phase:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test:run
bun run test:coverage
bun run build
```

---

## B. Alat dan Konvensi

- **Vitest** sebagai test runner, environment jsdom.
- **React Testing Library** untuk render dan assertion berbasis role/teks.
- **user-event** untuk interaksi pengguna.
- **MSW** untuk kontrak HTTP; request tanpa handler dianggap gagal.
- `renderWithProviders` memasang `QueryClientProvider` baru dan `MemoryRouter`.
- Fixture hanya di `src/test/fixtures/todos.ts`, tidak diimpor kode produksi.
- Tidak memakai snapshot sebagai pengganti assertion perilaku.
- Assertion memakai nama aksesibel, bukan selector CSS internal.

Handler default MSW menyediakan daftar todo kosong agar halaman workspace lama tetap dapat dirender. Test yang membutuhkan data mendaftarkan handler lebih spesifik lewat `server.use()`.

---

## C. Cakupan Unit

### Model dan mapper — `models/todo.mapper.test.ts`

- Mapping DTO ke domain, termasuk `Date`, `label`, dan `tags`.
- `description: null` dan `completedAt` dipertahankan.
- Mapping metadata pagination.
- Normalisasi request create (trim, deskripsi kosong menjadi `null`).
- `PATCH` hanya memuat field yang didefinisikan.
- Status/tanggal tidak valid menghasilkan `ApiError`.
- Helper `isTodoCompleted`, `isTodoActive`, `isTodoCancelled`, `splitTodosByStatus`, dan label status.

### Guard — `models/todo.guard.test.ts`

- Menerima DTO valid.
- Menolak status/tanggal/tag/field wajib yang rusak.
- `assertTodoResponseDto` dan `assertTodoListResponseDto` melempar `INVALID_TODO_RESPONSE`.

### Schema — `schemas/todo-schemas.test.ts`

- Judul wajib dan maksimal 200 karakter.
- Deskripsi maksimal 5000 karakter.
- Aturan create dan update konsisten.

### Validasi API — `utils/api-validation.test.ts`

- Pemetaan `body.title`/`description` ke field.
- Detail tidak relevan diabaikan.
- Pesan pertama dipertahankan.

### API service — `api/todo.api.test.ts`

- Query `limit`/`cursor` dan hasil mapping.
- Tanpa params tidak menambah query string.
- Detail, create, update, complete, dan delete.
- Payload create/update yang dinormalisasi.
- Error 401, 404, 403, 422 beserta detail validasi.
- Respons tidak valid (`INVALID_TODO_RESPONSE`).
- Kegagalan jaringan (`NETWORK_ERROR`).

### Hook — `hooks/todo-hooks.test.tsx`

- `useWorkspaceTodos` memakai `limit=100` dan memetakan hasil.
- Tidak retry pada 404.
- `useTodo` mengambil detail.
- Create mengisi cache detail dan menginvalidasi list workspace yang tepat.
- Update, complete, dan reopen memperbarui cache detail.
- Delete menghapus cache detail dan menginvalidasi list.
- Mutation Workspace B tidak mengubah cache Workspace A.

---

## D. Cakupan Komponen

| File test                       | Fokus                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `TodoFormFields.test.tsx`       | Batas panjang, hint, error per field, disabled state                                  |
| `TodoItem.test.tsx`             | Judul/deskripsi/tautan, status selesai, checkbox, menu aksi                           |
| `TodoEmptyState.test.tsx`       | Ilustrasi, judul, deskripsi, aksi, disabled                                           |
| `TodoList.test.tsx`             | Skeleton, empty, error + retry, pemisahan section, collapse, aksi                     |
| `CreateTodoDialog.test.tsx`     | Render, validasi, sukses, error backend/jaringan, double submit, discard              |
| `EditTodoDialog.test.tsx`       | Nilai awal, payload parsial, error, spasi saja, discard                               |
| `DeleteTodoDialog.test.tsx`     | Konfirmasi, batal, sukses, error                                                      |
| `WorkspaceTodoSection.test.tsx` | Loading, empty, error + retry, complete/reopen, create/edit/delete, feedback          |
| `TodoDetailPage.test.tsx`       | Loading, sukses, 404, 403, workspace mismatch, toggle, edit, delete + redirect, retry |

---

## E. Workflow Integrasi A–F

File: `src/features/todos/tests/todo-workflows.test.tsx`.

| Workflow | Skenario                                            | Assertion utama                                                |
| -------- | --------------------------------------------------- | -------------------------------------------------------------- |
| A        | Empty state → buat tugas                            | Dialog tertutup, feedback sukses, item muncul di section aktif |
| B        | Ubah judul dan deskripsi dari menu aksi             | Feedback sukses, judul/deskripsi baru tampil                   |
| C        | Selesaikan tugas → pindah ke Selesai → buka kembali | Item berpindah section dan kembali aktif                       |
| D        | Buka detail → hapus → kembali ke workspace          | Redirect ke workspace, empty state tampil                      |
| E        | Workspace A → Workspace B → mutasi di B             | Daftar A tidak tampil di B dan cache A tidak berubah           |
| F        | Detail 404 → kembali ke workspace                   | State “Tugas tidak ditemukan” dan navigasi berhasil            |

Workflow memakai `AppRoutes` dan handler MSW stateful sehingga invalidasi cache benar-benar memuat data terbaru, menyerupai backend nyata.

---

## F. Hasil Validasi Phase 4

Perintah dan hasil akhir:

| Pemeriksaan             | Hasil                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `bun run typecheck`     | Lulus                                                              |
| `bun run lint`          | Lulus                                                              |
| `bun run format:check`  | Lulus                                                              |
| `bun run test:run`      | 56 file, 239 test lulus                                            |
| `bun run test:coverage` | 90,98% statements, 86,30% branches, 93,46% functions, 90,96% lines |
| `bun run build`         | Lulus, bundle produksi terbentuk                                   |

Coverage fitur todo berada pada kisaran 84–100% per file. File komponen presentasional dan validasi mapping memiliki coverage tinggi; beberapa cabang defensive (misalnya guard untuk bentuk respons yang sangat rusak) tetap diuji pada level service.

---

## G. Batasan Pengujian

- Belum ada tes end-to-end terhadap backend nyata karena login/token belum tersedia.
- Tes memakai MSW, bukan database atau server HTTP sungguhan.
- Drag-and-drop, filter, sorting, dan infinite scroll tidak diuji karena tidak termasuk Phase 4.
- Waktu relatif (format tanggal `id-ID`) diuji secara tidak langsung; tidak ada snapshot tanggal yang rapuh.
