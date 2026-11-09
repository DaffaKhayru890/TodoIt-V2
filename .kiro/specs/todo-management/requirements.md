# Requirements Document

## Introduction

Phase 4 mengimplementasikan **Todo Management** sebagai fitur inti dari TodoIt-v2 frontend. Fitur ini mencakup CRUD operasi penuh untuk tugas, integrasi dengan backend API yang sudah ada, penanganan state dengan TanStack Query, dan UI yang mengikuti design system Neo Brutalism yang telah dibangun pada Phase 2.

Todo Management diimplementasikan di dalam konteks workspace dari Phase 3, di mana setiap tugas terikat pada satu workspace aktif. Phase 4 fokus pada fungsionalitas dasar: membuat, melihat, mengubah, menghapus, dan menandai selesai tugas. Fitur metadata seperti tag, label, priority, due date, dan reminder tidak termasuk dalam phase ini dan akan ditangani pada Phase 5.

Dokumen ini mendefinisikan kebutuhan fungsional dan non-fungsional berdasarkan EARS patterns dan mengikuti standar kualitas INCOSE. Backend tidak diubah pada phase ini; seluruh kontrak mengikuti source code backend yang sudah ada.

## Glossary

- **Todo/Tugas**: Entitas tugas yang dapat dibuat, diubah, dihapus, dan diselesaikan oleh pengguna dalam konteks workspace
- **Workspace**: Wadah utama yang menjadi induk dari todo, diimplementasikan pada Phase 3
- **Todo Status**: Kondisi tugas dengan nilai `todo`, `in_progress`, `completed`, atau `cancelled`
- **Todo Priority**: Tingkat kepentingan tugas dengan nilai `low`, `medium`, `high`, atau `urgent`
- **Active Todo**: Todo dengan status `todo` atau `in_progress`
- **Completed Todo**: Todo dengan status `completed`
- **Cancelled Todo**: Todo dengan status `cancelled`, tidak ditampilkan di UI Phase 4
- **Todo_DTO**: Data Transfer Object yang mewakili struktur respons backend
- **Todo_Domain**: Model domain internal frontend yang sudah dipetakan dari DTO
- **Todo_Mapper**: Komponen yang bertugas mengkonversi DTO ke Domain dan sebaliknya
- **Todo_Api**: Service terpusat untuk semua HTTP request terkait todo
- **Query_Key_Factory**: Pola untuk mengorganisir cache key TanStack Query dengan isolasi workspace
- **Soft_Delete**: Penghapusan logis yang menandai `deletedAt` tanpa menghapus data secara permanen
- **Cursor_Pagination**: Teknik pagination berbasis cursor yang digunakan backend untuk daftar todo
- **Optimistic_Update**: Pembaruan UI sebelum konfirmasi server untuk pengalaman pengguna yang lebih responsif
- **Neo_Brutalism**: Gaya visual design system dengan border tebal, shadow tegas, dan warna kontras tinggi
- **Workspace_Isolation**: Prinsip bahwa cache dan mutation todo harus terisolasi per workspace

## Requirements

### Requirement 1: Todo Domain Model

**User Story:** Sebagai developer, saya ingin model domain todo yang terstruktur, sehingga data dapat dipertukarkan antara backend dan frontend dengan aman.

#### Acceptance Criteria

1. THE Todo_Domain SHALL memiliki properti `id` (UUID), `workspaceId` (UUID), `title` (string 1-200 karakter), `description` (string maksimal 5000 karakter atau `null`), `status` (salah satu dari: `todo`, `in_progress`, `completed`, `cancelled`), `priority` (salah satu dari: `low`, `medium`, `high`, `urgent`), `dueAt` (Date atau `null`), `completedAt` (Date atau `null`), `label` (objek dengan `id`, `name`, `color` atau `null`), `tags` (array readonly objek dengan `id` dan `name`), `createdBy` (UUID), `createdAt` (Date), dan `updatedAt` (Date)

2. THE Todo_Mapper SHALL mengkonversi string ISO 8601 tanggal dari backend menjadi objek `Date` JavaScript

3. THE Todo_Mapper SHALL mempertahankan nilai `null` untuk field opsional seperti `description`, `dueAt`, `completedAt`, dan `label`

4. IF status atau priority dari backend bukan nilai yang valid, THEN THE Todo_Guard SHALL menghasilkan `ApiError` dengan kode `INVALID_TODO_RESPONSE`

5. THE Todo_Domain SHALL menyimpan `tags` sebagai array readonly untuk menjamin immutability

6. THE Todo_Mapper SHALL menghitung `mark` sebagai karakter pertama title yang di-trim dan di-upper-case, atau karakter 'T' jika title kosong atau hanya berisi whitespace

7. IF string tanggal dari backend tidak dapat di-parse sebagai Date valid, THEN THE Todo_Mapper SHALL menghasilkan `ApiError` dengan kode `INVALID_TODO_RESPONSE`

### Requirement 2: Todo API Integration

**User Story:** Sebagai developer, saya ingin service API terpusat untuk todo, sehingga seluruh HTTP request dapat dikelola secara konsisten.

#### Acceptance Criteria

1. THE Todo_Api SHALL menggunakan instance `httpClient` terpusat dari Phase 1 untuk semua request
2. THE Todo_Api SHALL mengirim header `Authorization: Bearer <token>` untuk semua endpoint yang memerlukan autentikasi
3. THE Todo_Api SHALL memetakan respons backend ke Todo_Domain melalui Todo_Mapper
4. WHEN backend mengembalikan error validasi dengan `details`, THE Todo_Api SHALL mempertahankan detail tersebut untuk ditampilkan di form
5. THE Todo_Api SHALL menggunakan endpoint yang sudah diverifikasi: `GET /todos`, `GET /todos/:id`, `POST /todos`, `PATCH /todos/:id`, `PATCH /todos/:id/complete`, dan `DELETE /todos/:id`
6. THE Todo_Api SHALL mengirim query parameter `workspaceId` untuk semua request yang memerlukan konteks workspace

### Requirement 3: TanStack Query Integration

**User Story:** Sebagai developer, saya ingin integrasi TanStack Query yang terstruktur, sehingga state server dapat dikelola dengan efisien.

#### Acceptance Criteria

1. THE Query_Key_Factory SHALL mengorganisir key dengan struktur hierarki: `todos` → `list` → `workspace` → `workspaceId`
2. THE Query_Key_Factory SHALL menyediakan key terpisah untuk detail: `todos` → `detail` → `workspaceId` → `todoId`
3. WHEN mutation create berhasil, THE system SHALL mengisi cache detail dan menginvalidasi cache list workspace terkait
4. WHEN mutation update/complete/reopen berhasil, THE system SHALL memperbarui cache detail dan menginvalidasi cache list
5. WHEN mutation delete berhasil, THE system SHALL menghapus cache detail dan menginvalidasi cache list
6. THE system SHALL tidak menginvalidasi cache workspace lain saat mutation dilakukan pada workspace tertentu
7. WHEN query menghasilkan error 401, 403, atau 404, THE system SHALL tidak melakukan retry otomatis

### Requirement 4: Todo List Display

**User Story:** Sebagai pengguna, saya ingin melihat daftar tugas di workspace saya, sehingga saya dapat mengelola pekerjaan saya.

#### Acceptance Criteria

1. WHEN pengguna membuka halaman workspace, THE system SHALL menampilkan `WorkspaceTodoSection` yang memuat daftar todo
2. THE system SHALL memisahkan todo ke dalam dua section: **Tugas Aktif** (status `todo` dan `in_progress`) dan **Tugas Selesai** (status `completed`)
3. WHEN todo memiliki status `cancelled`, THE system SHALL tidak menampilkan todo tersebut di kedua section
4. WHEN daftar todo kosong, THE system SHALL menampilkan `TodoEmptyState` dengan ilustrasi dan tombol "Buat tugas pertama"
5. WHEN data sedang dimuat, THE system SHALL menampilkan skeleton Neo Brutalism yang konsisten dengan design system
6. WHEN terjadi error saat memuat data, THE system SHALL menampilkan pesan error dengan tombol "Coba lagi"
7. WHEN error terjadi tapi data lama masih ada di cache, THE system SHALL menampilkan data lama dengan error inline

### Requirement 5: Create Todo Popup

**User Story:** Sebagai pengguna, saya ingin membuat tugas baru melalui dialog popup, sehingga saya dapat menambahkan tugas dengan cepat.

#### Acceptance Criteria

1. WHEN tombol "Buat Tugas" diklik, THE system SHALL menampilkan `CreateTodoDialog` dalam modal
2. THE dialog SHALL menampilkan nama workspace aktif sebagai judul atau subjudul
3. THE dialog SHALL memiliki field judul (wajib, 1-200 karakter setelah trim) dan deskripsi (opsional, maksimal 5000 karakter)
4. IF judul hanya berisi whitespace, THE system SHALL menampilkan pesan error pada field judul
5. WHEN pengguna menekan tombol submit, THE system SHALL memvalidasi form dengan Zod schema
6. WHEN validasi berhasil, THE system SHALL mengirim request `POST /todos` dengan field judul dan deskripsi yang sudah di-trim
7. WHEN deskripsi kosong dikirim, THE system SHALL mengirim `null` bukan string kosong
8. WHEN request berhasil, THE system SHALL menutup dialog, menginvalidasi cache list todo workspace aktif, dan menampilkan toast notifikasi sukses
9. IF request gagal dengan `VALIDATION_ERROR`, THE system SHALL memetakan setiap `error.details[].path` ke field form yang sesuai dan menampilkan `error.details[].message` sebagai pesan error field
10. IF request gagal dengan error jaringan, THE system SHALL menampilkan pesan "Gagal menghubungi server" di atas form tanpa menutup dialog
11. IF form berada dalam kondisi dirty (memiliki perubahan yang belum disimpan), THE system SHALL menampilkan dialog konfirmasi `DiscardChanges` sebelum menutup
12. THE dialog SHALL menonaktifkan tombol submit saat form sedang disubmit (`isSubmitting` bernilai `true`) atau mutation sedang berjalan (`isPending` bernilai `true`)

### Requirement 6: Edit Todo Popup

**User Story:** Sebagai pengguna, saya ingin mengubah tugas yang sudah ada, sehingga saya dapat memperbarui informasi tugas.

#### Acceptance Criteria

1. WHEN tombol "Ubah" diklik dari menu aksi atau halaman detail, THE system SHALL menampilkan `EditTodoDialog`
2. THE dialog SHALL memuat nilai judul dan deskripsi terkini saat dibuka
3. THE dialog SHALL menggunakan `TodoFormFields` yang sama dengan create untuk konsistensi
4. WHEN tidak ada perubahan yang dilakukan, THE tombol "Simpan Perubahan" SHALL tetap nonaktif
5. WHEN hanya ada perubahan whitespace (spasi saja), THE system SHALL menutup dialog tanpa mengirim request
6. WHEN ada perubahan substantive, THE system SHALL mengirim `PATCH /todos/:id` hanya dengan field yang berubah
7. WHEN request berhasil, THE system SHALL menutup dialog, memperbarui cache detail, dan menampilkan feedback sukses
8. WHEN request gagal, THE system SHALL menampilkan error inline tanpa menutup dialog
9. WHEN pengguna menutup form yang sudah diubah, THE system SHALL menampilkan konfirmasi `DiscardChanges`

### Requirement 7: Todo Item Component

**User Story:** Sebagai pengguna, saya ingin melihat setiap tugas sebagai item yang interaktif, sehingga saya dapat dengan mudah mengidentifikasi dan mengelola tugas.

#### Acceptance Criteria

1. THE `TodoItem` SHALL menampilkan checkbox, judul, deskripsi (jika ada), dan menu aksi dropdown
2. THE judul todo SHALL menjadi tautan ke halaman detail `/workspace/:workspaceId/todos/:todoId`
3. WHEN todo memiliki status `completed`, THE system SHALL menampilkan judul dengan style struck-through dan warna muted
4. THE checkbox SHALL memiliki label aksesibel yang berubah sesuai status: "Tandai tugas ... sebagai selesai" atau "Buka kembali tugas ..."
5. THE menu aksi SHALL memiliki `aria-label` unik per item: "Aksi untuk [judul todo]"
6. WHEN item sedang diproses (toggle status), THE system SHALL menonaktifkan checkbox dan menandai artikel dengan `aria-busy`
7. THE `TodoItem` SHALL memotong judul panjang dengan ellipsis dan menampilkan tooltip dengan judul lengkap

### Requirement 8: Todo Completion

**User Story:** Sebagai pengguna, saya ingin menandai tugas sebagai selesai, sehingga saya dapat melacak kemajuan saya.

#### Acceptance Criteria

1. WHEN checkbox todo aktif diklik, THE system SHALL mengirim request `PATCH /todos/:id/complete`
2. THE system SHALL menonaktifkan checkbox item tersebut selama request berlangsung
3. WHEN request berhasil, THE system SHALL memperbarui cache detail, menginvalidasi cache list, dan memindahkan item ke section Selesai
4. WHEN request gagal, THE system SHALL menampilkan error inline dan mengembalikan checkbox ke state semula
5. THE system SHALL menyimpan `updatingTodoId` untuk melacak item mana yang sedang diproses
6. WHILE item sedang diproses, THE item SHALL memiliki atribut `aria-busy="true"`

### Requirement 9: Todo Reopen

**User Story:** Sebagai pengguna, saya ingin membuka kembali tugas yang sudah selesai, sehingga saya dapat memperbaiki kesalahan atau melanjutkan pekerjaan.

#### Acceptance Criteria

1. WHEN checkbox todo selesai diklik, THE system SHALL mengirim request `PATCH /todos/:id` dengan body `{ "status": "todo" }`
2. THE system SHALL menonaktifkan checkbox item tersebut selama request berlangsung
3. WHEN request berhasil, THE system SHALL memperbarui cache detail, menginvalidasi cache list, dan memindahkan item ke section Aktif
4. WHEN request gagal, THE system SHALL menampilkan error inline dan mengembalikan checkbox ke state semula
5. THE reopened todo SHALL memiliki `completedAt` yang direset ke `null` oleh backend

### Requirement 10: Delete Todo Confirmation

**User Story:** Sebagai pengguna, saya ingin menghapus tugas dengan konfirmasi, sehingga saya tidak menghapus tugas secara tidak sengaja.

#### Acceptance Criteria

1. WHEN tombol "Hapus" diklik dari menu aksi atau halaman detail, THE system SHALL menampilkan `DeleteTodoDialog`
2. THE dialog SHALL menyebutkan judul todo yang akan dihapus
3. THE dialog SHALL menjelaskan bahwa penghapusan bersifat permanen dan tidak dapat dipulihkan dari aplikasi
4. WHEN tombol konfirmasi diklik, THE system SHALL mengirim request `DELETE /todos/:id`
5. WHEN request berhasil, THE system SHALL menutup dialog, menghapus cache detail, menginvalidasi cache list, dan menampilkan feedback sukses
6. WHEN penghapusan dari halaman detail, THE system SHALL melakukan navigasi `replace` ke halaman workspace
7. WHEN request gagal, THE system SHALL menampilkan error inline dan dialog tetap terbuka
8. THE dialog SHALL tidak dapat ditutup selama request berlangsung

### Requirement 11: Todo Detail View

**User Story:** Sebagai pengguna, saya ingin melihat detail lengkap tugas, sehingga saya dapat memahami semua informasi terkait tugas tersebut.

#### Acceptance Criteria

1. WHEN pengguna membuka `/workspace/:workspaceId/todos/:todoId`, THE system SHALL menampilkan `TodoDetailPage`
2. THE page SHALL mengambil detail todo dan nama workspace secara paralel
3. THE page SHALL menampilkan judul, status, deskripsi, nama workspace, tanggal dibuat, tanggal diperbarui, dan `completedAt` (jika ada)
4. THE page SHALL menyediakan aksi: tandai selesai/buka kembali, ubah, dan hapus
5. WHEN data sedang dimuat, THE page SHALL menampilkan skeleton Neo Brutalism
6. WHEN todo tidak ditemukan (404), THE page SHALL menampilkan state "Tugas tidak ditemukan" dengan tombol kembali ke workspace
7. WHEN akses ditolak (403), THE page SHALL menampilkan state "Akses ditolak" dengan tombol kembali ke workspace
8. THE page SHALL memvalidasi bahwa `todo.workspaceId` cocok dengan parameter URL workspace
9. THE page SHALL menggunakan `useDocumentTitle` dengan judul todo sebagai title halaman

### Requirement 12: Workspace Integration

**User Story:** Sebagai pengguna, saya ingin melihat daftar tugas terintegrasi di halaman workspace, sehingga saya dapat mengelola tugas dalam konteks yang tepat.

#### Acceptance Criteria

1. THE `WorkspacePage` SHALL merender `WorkspaceTodoSection` dengan props `workspaceId` dan `workspaceName`
2. THE `WorkspacePage` SHALL memberi `key={workspace.id}` pada section untuk mencegah state bocor antar workspace
3. THE `WorkspaceTodoSection` SHALL memiliki query daftar todo yang terisolasi per workspace
4. WHEN workspace tidak memiliki todo, THE section SHALL menampilkan empty state dengan aksi buat tugas pertama
5. THE section SHALL menampilkan feedback sukses/error untuk semua mutation dengan `role="status"` atau `role="alert"`
6. THE section SHALL mengelola state dialog create, edit, dan delete secara lokal

### Requirement 13: Error Handling

**User Story:** Sebagai pengguna, saya ingin melihat pesan error yang jelas, sehingga saya dapat memahami dan memperbaiki masalah.

#### Acceptance Criteria

1. WHEN backend mengembalikan `VALIDATION_ERROR` dengan detail, THE system SHALL memetakan `body.title` ke field judul dan `body.description` ke field deskripsi
2. WHEN backend mengembalikan `VALIDATION_ERROR` tanpa detail yang cocok, THE system SHALL menampilkan pesan umum di atas form
3. WHEN backend mengembalikan `TODO_NOT_FOUND`, THE system SHALL menampilkan state "Tugas tidak ditemukan"
4. WHEN backend mengembalikan `WORKSPACE_PERMISSION_DENIED`, THE system SHALL menampilkan state "Akses ditolak"
5. WHEN terjadi error jaringan atau 5xx, THE system SHALL menampilkan pesan error dengan tombol "Coba lagi"
6. WHEN respons backend tidak sesuai ekspektasi, THE system SHALL menghasilkan `ApiError` dengan kode `INVALID_TODO_RESPONSE`
7. THE UI SHALL tidak pernah menampilkan stack trace atau objek error mentah ke pengguna

### Requirement 14: Accessibility

**User Story:** Sebagai pengguna dengan kebutuhan aksesibilitas, saya ingin semua komponen todo dapat diakses, sehingga saya dapat menggunakan aplikasi dengan teknologi bantuan.

#### Acceptance Criteria

1. THE semua dialog SHALL menggunakan komponen `Modal` dengan `role="dialog"`, judul yang terlihat, focus trap, dan dukungan Escape untuk menutup
2. THE checkbox SHALL memiliki label aksesibel meskipun label visual disembunyikan
3. THE tombol ikon SHALL menggunakan `aria-label` yang deskriptif
4. THE menu aksi dropdown SHALL menggunakan `role="menu"` dan `role="menuitem"`
5. THE feedback sukses SHALL menggunakan `role="status"` dan feedback error SHALL menggunakan `role="alert"`
6. THE section daftar SHALL menggunakan heading dengan level yang tepat
7. THE item yang sedang diproses SHALL memiliki `aria-busy="true"`
8. THE tautan dan tombol SHALL memiliki focus-visible outline yang jelas

### Requirement 15: Neo Brutalism Design

**User Story:** Sebagai pengguna, saya ingin UI yang konsisten dengan design system Neo Brutalism, sehingga aplikasi terlihat kohesif dan profesional.

#### Acceptance Criteria

1. THE semua komponen todo SHALL menggunakan border tebal (2px/3px hitam) dan shadow tegas sesuai token Phase 2
2. THE semua komponen SHALL menggunakan class semantik CSS, bukan utility classes inline
3. THE stylesheet SHALL diimpor dari `globals.css`, bukan dari file TSX
4. THE warna SHALL menggunakan variabel token (`--color-*`, `--space-*`, `--text-*`)
5. THE layout SHALL responsif: header dan aksi menumpuk di layar kecil, tombol menjadi penuh di mobile
6. THE skeleton loading SHALL menggunakan animasi pulse yang mematuhi `prefers-reduced-motion: reduce`

### Requirement 16: Testing Requirements

**User Story:** Sebagai developer, saya ingin coverage testing yang komprehensif, sehingga kode dapat diandalkan dan maintainable.

#### Acceptance Criteria

1. THE test suite SHALL mencakup unit tests untuk semua models, mappers, guards, dan schemas
2. THE test suite SHALL mencakup unit tests untuk API service dengan MSW mocking
3. THE test suite SHALL mencakup unit tests untuk semua TanStack Query hooks
4. THE test suite SHALL mencakup component tests untuk semua komponen UI
5. THE test suite SHALL mencakup integration-style workflow tests untuk user journeys utama
6. THE tests SHALL menggunakan Vitest, React Testing Library, user-event, dan MSW
7. THE tests SHALL tidak menggunakan snapshot sebagai pengganti behavioral assertions
8. THE tests SHALL menggunakan `renderWithProviders` dengan `QueryClientProvider` baru dan `MemoryRouter`
9. THE fixture SHALL hanya berada di `src/test/fixtures/` dan tidak diimpor oleh kode produksi
10. WHEN menjalankan `bun run test:coverage`, THE coverage SHALL minimal 80% untuk semua metrics

### Requirement 17: Documentation

**User Story:** Sebagai developer, saya ingin dokumentasi yang lengkap dalam Bahasa Indonesia, sehingga tim dapat memahami implementasi dengan mudah.

#### Acceptance Criteria

1. THE documentation SHALL mencakup `todo-management.md` yang menjelaskan ruang lingkup, model domain, dan alur pengguna
2. THE documentation SHALL mencakup `todo-api-integration.md` yang menjelaskan endpoint, request/response, dan strategi cache
3. THE documentation SHALL mencakup `todo-components.md` yang menjelaskan struktur komponen, props, dan tanggung jawab
4. THE documentation SHALL mencakup `todo-testing.md` yang menjelaskan cakupan test dan hasil validasi
5. THE documentation SHALL ditulis dalam Bahasa Indonesia
6. THE documentation SHALL menjelaskan fitur yang sengaja tidak diimplementasikan pada Phase 4

### Requirement 18: Backend API Verification

**User Story:** Sebagai developer, saya ingin kontrak API yang diverifikasi dari source code backend, sehingga integrasi berjalan lancar tanpa asumsi.

#### Acceptance Criteria

1. THE semua endpoint yang digunakan SHALL diverifikasi dari file backend `todo.routes.ts` dan `todo.schemas.ts`
2. THE response shape SHALL diverifikasi dari use case dan schema backend
3. THE query parameters yang didukung SHALL didokumentasikan: `limit`, `cursor`, dan filter opsional
4. THE authorization rules SHALL diverifikasi dari source code backend: role yang boleh mengakses dan aksi yang diizinkan
5. THE error codes yang mungkin SHALL didokumentasikan: `TODO_NOT_FOUND`, `WORKSPACE_ACCESS_DENIED`, `WORKSPACE_PERMISSION_DENIED`, `VALIDATION_ERROR`
6. WHEN endpoint tidak tersedia atau berbeda dari ekspektasi, THE system SHALL mencatatnya sebagai batasan yang diketahui

### Requirement 19: Non-Functional Requirements

**User Story:** Sebagai pengguna dan developer, saya ingin performa dan kualitas kode yang baik, sehingga aplikasi dapat digunakan dengan nyaman.

#### Acceptance Criteria

1. THE aplikasi SHALL lolos `bun run typecheck` tanpa error TypeScript
2. THE aplikasi SHALL lolos `bun run lint` tanpa error ESLint
3. THE aplikasi SHALL lolos `bun run format:check` sesuai konfigurasi Prettier
4. THE aplikasi SHALL lolos `bun run build` dan menghasilkan bundle produksi yang valid
5. THE bundle size SHALL dioptimasi dengan code splitting yang tepat
6. THE respons UI SHALL responsif dengan feedback loading yang jelas untuk semua async operation
