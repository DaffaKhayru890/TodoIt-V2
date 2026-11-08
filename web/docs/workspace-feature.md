# Fitur Workspace (Phase 3)

Dokumen ini menjelaskan implementasi fitur **Workspace Management** pada TodoIt-v2 frontend, integrasi API backend, arsitektur modul, state management TanStack Query, penanganan permission, pengujian, serta batasan-batasan teknis backend saat ini.

---

## A. Workspace Overview

### 1. Tujuan Workspace

Workspace adalah domain inti dan wadah utama (_container boundary_) di mana pengguna mengorganisasi seluruh daftar tugas, tag, label, dan kolaborasi tim pada TodoIt-v2.

### 2. Domain Model Workspace

Workspace mewakili entitas ruang kerja yang memiliki:

- **Identifier unik (UUID):** Dihasilkan oleh backend PostgreSQL.
- **Nama (Name):** String 1–100 karakter.
- **Deskripsi (Description):** Teks opsional maksimal 500 karakter.
- **Role Keanggotaan:** Peran pengguna pada workspace tersebut (`owner`, `admin`, atau `member`).
- **Metadata Waktu:** `createdAt`, `updatedAt`, dan `archivedAt` (untuk soft archive).
- **Mark:** Inisial visual huruf kapital yang diturunkan secara deterministik dari nama workspace untuk identitas visual Neo Brutalism.

### 3. Hubungan Workspace dengan Todolist

Workspace adalah induk dari entitas Todo. Seluruh todolist, filter hari ini (today), upcoming, completed, label, dan tag berada di bawah konteks satu workspace aktif (`/workspace/:workspaceId/*`). Pada Phase 3, boundary konten todolist telah disiapkan dalam bentuk slot dan state kosong (_Workspace Empty State_) tanpa membuat data mock tugas, menunggu implementasi CRUD Todo pada Phase 4.

### 4. Workspace User Experience

- **Seleksi Cepat di Primary Sidebar:** Pengguna dapat berpindah ruang kerja secara instan melalui daftar item workspace di Primary Sidebar.
- **URL sebagai Single Source of Truth:** Active workspace selalu tersinkronisasi dengan parameter URL (`/workspace/:workspaceId`). Refresh halaman, tombol back/forward browser, maupun tautan langsung menjaga workspace aktif yang benar.
- **Feedback Interaktif & Neo Brutalism:** Seluruh elemen dialog, formulir, badge role, header, dan empty state mengadopsi bahasa visual Neo Brutalism (border tebal 2px/3px hitam, bayangan tegas `box-shadow: 4px 4px 0 #171717`, warna kontras tinggi).

### 5. Hasil Pemeriksaan Phase 1 & Phase 2

Sebelum Phase 3, source code aktual (bukan hanya dokumentasi) diperiksa. Ringkasan temuan:

| Area                     | Kondisi awal                                                                                                          | Tindakan Phase 3                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Provider aplikasi        | `QueryProvider` + `QueryClient` tunggal per aplikasi                                                                  | Dipertahankan; tidak ada perubahan struktur                          |
| HTTP client              | `createHttpClient` dengan `getAccessToken` opsional, `ApiError`                                                       | Diperluas agar mempertahankan `details` error validasi backend       |
| Router                   | Layout route `AppLayout` + `/workspace/:workspaceId`                                                                  | Dipakai ulang; detail workspace terhubung ke rute yang ada           |
| Design system            | Button, Input, Textarea, Badge, Avatar, Modal, Dropdown, Popover, EmptyState, Skeleton, Checkbox, Tooltip, IconButton | Dipakai ulang tanpa duplikasi komponen                               |
| Layout                   | Primary/Secondary sidebar, drawer mobile, collapse preference                                                         | Dipertahankan; Primary Sidebar dihubungkan ke API                    |
| Testing                  | Vitest, RTL, user-event, MSW, `renderWithProviders`                                                                   | Dipertahankan; fixture dipindah ke `src/test/fixtures`               |
| Fixture produksi         | `workspace-fixtures.ts` masih diimpor sidebar untuk nama pengguna dan label “Data contoh”                             | Dihapus dari runtime produksi; fixture hanya tersedia di folder test |
| Semantik halaman         | `WorkspacePage` merender `<main>` di dalam `<main>` milik `MainContent`                                               | Diperbaiki menjadi elemen blok biasa                                 |
| Navigasi tanpa workspace | Secondary sidebar menghasilkan tautan `/workspace//today` saat daftar kosong                                          | Section workspace disembunyikan sampai ada workspace                 |

Komponen Phase 2 yang dipakai ulang: `Modal`, `Button`, `Input`, `Textarea`, `Badge`, `Avatar`, `Skeleton`, `EmptyState`, `Dropdown`, `IconButton`, dan `WorkspaceItem`.

---

## B. Workspace Architecture

Modul workspace diimplementasikan secara modular pada folder `src/features/workspaces/` dengan struktur:

```text
src/features/workspaces/
├── api/
│   ├── workspace.api.ts          # Centralized API service
│   ├── workspace.api.test.ts     # Unit test API service (MSW)
│   └── workspace.query-keys.ts   # TanStack Query Key Factory
│
├── components/
│   ├── archive-workspace-dialog/ # Dialog konfirmasi pengarsipan
│   ├── create-workspace-dialog/  # Dialog pembuatan workspace baru
│   ├── discard-changes/          # Konfirmasi membuang perubahan form
│   ├── edit-workspace-dialog/    # Dialog pengubahan nama & deskripsi
│   ├── workspace-empty-state/    # Neo Brutalism empty state
│   └── workspace-header/         # Header detail workspace & action bar
│
├── hooks/
│   ├── use-archive-workspace.ts  # Mutation hook archive workspace
│   ├── use-create-workspace.ts   # Mutation hook create workspace
│   ├── use-update-workspace.ts   # Mutation hook update workspace
│   ├── use-workspace.ts          # Query hook detail workspace
│   ├── use-workspaces.ts         # Query hook list workspace
│   └── workspace-hooks.test.tsx  # Unit test custom hooks
│
├── models/
│   ├── workspace.dto.ts          # Kontrak interface DTO backend
│   ├── workspace.mapper.ts       # Pemetaan DTO ke Domain Entity
│   ├── workspace.mapper.test.ts  # Unit test mapper
│   └── workspace.model.ts        # Domain model internal frontend
│
├── pages/
│   ├── WorkspacePage.tsx         # Halaman utama detail workspace
│   ├── workspace-page.css        # Stylesheet halaman detail
│   └── WorkspacePage.test.tsx    # Test komprehensif halaman detail
│
├── schemas/
│   ├── create-workspace.schema.ts# Schema validasi Zod untuk Create
│   ├── update-workspace.schema.ts# Schema validasi Zod untuk Update
│   └── workspace-schemas.test.ts # Unit test validasi schema
│
├── tests/
│   └── workspace-workflows.test.tsx # Integration-style workflow test
│
├── utils/
│   └── api-validation.ts         # Pemetaan detail VALIDATION_ERROR ke field form
│
└── index.ts                      # Barrel export fitur workspace
```

Fixture pengujian tidak lagi berada di `src/app`. Fixture workspace ada di
`src/test/fixtures/workspaces.ts` dan hanya diimpor oleh test serta handler MSW.

### Tanggung Jawab Komponen

- **`workspace.api.ts`:** Menggunakan instance terpusat `httpClient` dari Phase 1 (`src/core/api/http-client.ts`), mengisolasi seluruh HTTP call dan serialisasi query params.
- **`workspace.mapper.ts`:** Melakukan parsing tanggal string ISO ke objek `Date`, normalisasi role ke `WorkspaceRole`, dan kalkulasi inisial `mark`.
- **`workspace.query-keys.ts`:** Mengatur hierarki query key TanStack Query untuk kemudahan invalidasi cache terarah (`lists()` dan `detail(id)`).
- **`CreateWorkspaceDialog` & `EditWorkspaceDialog`:** Menggunakan `react-hook-form` + `@hookform/resolvers/zod` dengan komponen form reusable (`Input`, `Textarea`, `Button`, `Modal`). Keduanya mendeteksi dirty state dan menampilkan `DiscardChanges` sebelum isian dibuang.
- **`api-validation.ts`:** Memetakan `error.details` dari backend (mis. `body.name`) ke field form. Backend tetap menjadi validator utama.

---

## C. Workspace API Integration

### 1. Endpoint yang Diverifikasi & Diintegrasikan

| Endpoint                                  | HTTP Method | Auth   | Tanggung Jawab                                                | Status Integrasi                     |
| ----------------------------------------- | ----------- | ------ | ------------------------------------------------------------- | ------------------------------------ |
| `/api/v1/workspaces`                      | `GET`       | Bearer | Mengambil daftar workspace aktif (hanya `archivedAt IS NULL`) | PASS                                 |
| `/api/v1/workspaces`                      | `POST`      | Bearer | Membuat workspace baru; pembuat otomatis menjadi owner        | PASS                                 |
| `/api/v1/workspaces/:workspaceId`         | `GET`       | Bearer | Mengambil detail workspace berdasarkan ID                     | PASS                                 |
| `/api/v1/workspaces/:workspaceId`         | `PATCH`     | Bearer | Memperbarui nama (1-100) dan deskripsi (0-500)                | PASS                                 |
| `/api/v1/workspaces/:workspaceId/archive` | `POST`      | Bearer | Mengarsipkan workspace (soft archive)                         | PASS                                 |
| `/api/v1/workspaces/:workspaceId`         | `DELETE`    | -      | Hard delete workspace permanen                                | **BLOCKED** (Tidak didukung backend) |

Catatan otorisasi hasil audit source code backend:

- Role yang dikembalikan backend adalah `owner`, `admin`, atau `member`.
- `GET /api/v1/workspaces` hanya mengembalikan workspace aktif (`archived_at IS NULL`) tempat pengguna menjadi anggota.
- `GET /api/v1/workspaces/:workspaceId` mengembalikan **404** (kode `WORKSPACE_ACCESS_DENIED`) untuk non-member dan workspace yang sudah diarsipkan. Backend sengaja memakai 404, bukan 403, untuk mencegah enumerasi UUID.
- `PATCH` dan `POST /archive` hanya boleh dilakukan `owner`. Non-member mendapat 404; anggota dengan role `admin`/`member` mendapat **403** (`WORKSPACE_PERMISSION_DENIED`).
- Tidak ada field `color`, `icon`, `slug`, atau unique name di schema backend. Frontend tidak menampilkan kontrol yang tidak dapat disimpan.

### 2. Authentication Requirement

Seluruh endpoint workspace memerlukan header `Authorization: Bearer <access token>`.
Phase 1 belum mengimplementasikan login, penyimpanan access token, maupun refresh
token. Karena itu integrasi API pada Phase 3 sudah lengkap di layer service, tetapi
penggunaan end-to-end terhadap backend memerlukan phase autentikasi. `httpClient`
sudah menyediakan titik integrasi `getAccessToken`; frontend tidak mengarang token
atau mekanisme login sendiri.

### 3. Request & Response Payload

#### A. Create Workspace

- **Request (`POST /api/v1/workspaces`):**
  ```json
  {
    "name": "Proyek Peluncuran",
    "description": "Workspace koordinasi tim peluncuran"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "workspace": {
      "id": "e4b6c867-0c7f-4c12-9c94-9a3b689a7bb1",
      "name": "Proyek Peluncuran",
      "description": "Workspace koordinasi tim peluncuran",
      "role": "owner",
      "createdAt": "2026-11-07T12:00:00.000Z",
      "updatedAt": "2026-11-07T12:00:00.000Z",
      "archivedAt": null
    }
  }
  ```

#### B. Update Workspace

- **Request (`PATCH /api/v1/workspaces/:workspaceId`):**
  ```json
  {
    "name": "Proyek Peluncuran Rev-2",
    "description": null
  }
  ```
- **Response (200 OK):** Mengembalikan objek `workspace` terbaru.

#### C. Archive Workspace

- **Request (`POST /api/v1/workspaces/:workspaceId/archive`):** Tanpa body.
- **Response (200 OK):**
  ```json
  {
    "workspace": {
      "id": "e4b6c867-0c7f-4c12-9c94-9a3b689a7bb1",
      "archivedAt": "2026-11-07T12:30:00.000Z"
    }
  }
  ```

### 4. Error Normalization

Backend mengembalikan envelope error terstandarisasi:

```json
{
  "error": {
    "code": "WORKSPACE_PERMISSION_DENIED",
    "message": "Hanya owner yang berhak memperbarui workspace.",
    "requestId": "req-xyz"
  }
}
```

HTTP Client menormalkan respons ini menjadi instance `ApiError` yang menyimpan
`status`, `code`, `message`, dan `details`. Untuk `VALIDATION_ERROR`, detail
seperti `body.name` dipetakan ke field form terkait; pesan umum hanya ditampilkan
jika tidak ada detail yang cocok. UI tidak pernah menampilkan objek error mentah
atau stack trace.

### 5. Query Invalidation Strategy

- **Setelah Create:** Invalidate query key `workspaceKeys.lists()` dan set detail cache untuk ID baru. Pengguna otomatis dinavigasi ke rute detail workspace baru.
- **Setelah Update:** Invalidate query key `workspaceKeys.lists()` dan set query data untuk `workspaceKeys.detail(id)`. Header detail dan sidebar langsung diperbarui secara sinkron.
- **Setelah Archive:** Invalidate query key `workspaceKeys.lists()` dan hapus cache detail `workspaceKeys.detail(id)`. Pengguna dipindahkan ke rute aman (`/inbox`).

---

## D. Workspace UI

### 1. Primary Sidebar Integration

- Mengambil daftar workspace melalui TanStack Query hook `useWorkspaces({ limit: 50 })`. Batas 50 adalah maksimum yang diizinkan backend untuk satu halaman.
- **Loading State:** Menampilkan 3 item skeleton Neo Brutalism (`primary-sidebar__skeleton-list`). Empty state tidak ditampilkan sebelum request selesai.
- **Error State:** Menampilkan kotak alert merah (`primary-sidebar__status--error`) disertai tombol "Coba lagi" (_Retry_). Jika data lama masih ada di cache, daftar workspace tetap ditampilkan agar pengguna tidak kehilangan konteks; error tidak diganti dengan empty state.
- **Empty State:** Jika pengguna belum memiliki workspace, menampilkan pesan ringkas dan tombol buat workspace pertama.
- **Add Workspace Entry:** Tombol "Tambah workspace" membuka `CreateWorkspaceDialog` langsung secara modal tanpa meninggalkan rute saat ini.
- **Tanpa Workspace:** Secondary sidebar menyembunyikan section Workspace dan tautan Today/Upcoming sampai ada workspace aktif, sehingga tidak ada tautan `/workspace//...` yang rusak.

### 2. Workspace Selector & Item

- Menampilkan inisial mark tebal, nama terpotong rapi dengan CSS truncation (`text-overflow: ellipsis`), dan atribut `title` untuk tooltip nama panjang.
- Indikator aktif warna kuning brutalism (`var(--color-primary)`) dan bayangan `shadow-brutal-sm` saat rute aktif cocok dengan ID workspace.

### 3. Create Workspace Dialog

- Form berbasis accessible `Modal` dialog dengan tombol close, penutup Escape, dan backdrop.
- Validasi instan Zod + React Hook Form pada field nama (wajib, 1-100 karakter) dan deskripsi (opsional, maksimal 500 karakter).
- Pencegahan multiple submit (`isSubmitting || isPending`).
- Dirty state dilindungi: menutup form yang sudah diisi menampilkan konfirmasi `DiscardChanges`.
- Error `VALIDATION_ERROR` backend dipetakan ke field terkait bila `details.path` cocok.

### 4. Edit Workspace Dialog

- Memuat nama dan deskripsi terkini ke form saat dibuka.
- Deteksi perubahan (_dirty state_): tombol "Simpan Perubahan" hanya aktif jika ada field yang diubah.
- Menutup form yang sudah diubah memunculkan konfirmasi sebelum isian dibuang.
- Hanya diizinkan untuk peran Owner; anggota non-owner melihat peringatan izin akses.
- Payload `PATCH` selalu memuat nilai aktual nama dan deskripsi, sehingga field yang tidak diubah tidak terhapus. String deskripsi kosong dikirim sebagai `null` sesuai schema backend.

### 5. Archive Workspace Dialog

- Menampilkan konfirmasi jelas dengan menyebutkan nama workspace yang hendak diarsipkan.
- Menjelaskan dampak pengarsipan (workspace disembunyikan dari daftar aktif).
- Memanggil mutasi pengarsipan dan mengarahkan kembali ke `/inbox`.

### 6. Workspace Detail Page

- Halaman detail workspace (`WorkspacePage.tsx`) terpasang pada rute `/workspace/:workspaceId`.
- **Loading:** Skeleton header dan card.
- **Not Found (404 / `WORKSPACE_NOT_FOUND` / `WORKSPACE_ACCESS_DENIED`):** Tampilan empty state informatif dengan tombol kembali ke inbox.
- **Access Denied (403 / `WORKSPACE_PERMISSION_DENIED`):** Tampilan penolakan hak akses dengan tombol ke inbox.
- **Header:** Menampilkan avatar inisial, nama workspace, badge status peran (_Owner_, _Admin_, _Anggota_), deskripsi, tanggal dibuat, serta tombol aksi edit/archive untuk owner.
- **Content Area:** Dilengkapi dengan `WorkspaceEmptyState` Neo Brutalism berilustrasi lokal yang menjelaskan bahwa workspace siap dipakai untuk mengorganisasi todolist.

---

## E. Permission Handling

Backend TodoIt-v2 menerapkan kebijakan otorisasi berbasis peran keanggotaan:

- **Role `owner`:** Memiliki hak penuh untuk melihat (`VIEW`), memperbarui (`UPDATE`), dan mengarsipkan (`ARCHIVE`) workspace.
- **Role `admin` & `member`:** Memiliki hak untuk melihat workspace (`VIEW`), namun dilarang keras melakukan update maupun arsip.
- **Non-member:** Backend mengembalikan status `404 Not Found` (dengan kode internal `WORKSPACE_ACCESS_DENIED`) untuk mencegah penyerang melakukan enumerasi UUID workspace milik pengguna lain.

### Penerapan pada Frontend

- Tombol "Ubah" dan "Arsipkan" pada `WorkspaceHeader` hanya ditampilkan jika `workspace.role === 'owner'`.
- Pada `EditWorkspaceDialog` dan `ArchiveWorkspaceDialog`, terdapat guard ganda: jika pengguna non-owner membuka dialog, form disembunyikan dan pesan penolakan izin ditampilkan.
- Apabila backend mengembalikan respons 403 atau 404, query hook tidak melakukan retry yang sia-sia, melainkan langsung menyajikan state "Akses ditolak" atau "Workspace tidak ditemukan".

---

## F. Testing

Pengujian dilakukan menggunakan **Vitest**, **React Testing Library**, **userEvent**, dan **MSW (Mock Service Worker)**. Fixture hanya berada di `src/test/fixtures/workspaces.ts`.

1. **Model & Mapper Tests (`workspace.mapper.test.ts`):** Ekstraksi mark, fallback parsing role, konversi ISO string ke `Date`, dan mapping DTO request.
2. **Schema Tests (`workspace-schemas.test.ts`):** Validasi batas panjang, string kosong, dan whitespace trimming.
3. **API Validation Utility (`api-validation.test.ts`):** Pemetaan `details.path` backend ke field form.
4. **API Service Tests (`workspace.api.test.ts`):** Seluruh method HTTP, query pagination, payload body, error 404, 403, dan detail validasi 422.
5. **HTTP Client Tests (`http-client.test.ts`):** Normalisasi error, `details` validasi, error jaringan, JSON tidak valid, dan header Bearer.
6. **Hook Tests (`workspace-hooks.test.tsx`):** Query list/detail, error 401 tanpa retry berulang, create/update/archive, invalidasi list, pengisian detail cache, dan penghapusan detail cache setelah archive.
7. **Component Tests:**
   - `WorkspaceItem.test.tsx` — nama, mark, active state, nama panjang.
   - `PrimarySidebar.test.tsx` — loading, error + retry, cache tetap tampil saat refetch gagal, empty state, aksi tambah.
   - `CreateWorkspaceDialog.test.tsx` — validasi, sukses, error backend, detail validasi field, dirty close.
   - `EditWorkspaceDialog.test.tsx` — nilai awal, non-owner, sukses, error 403, detail validasi, dirty close.
   - `ArchiveWorkspaceDialog.test.tsx` — konfirmasi, non-owner, sukses, error.
   - `DiscardChanges.test.tsx` — peringatan, callback, state sibuk.
   - `WorkspaceHeader.test.tsx` — identitas, aksi owner, penyembunyian aksi non-owner.
   - `WorkspaceEmptyState.test.tsx` — boundary/slot empty state.
   - `WorkspacePage.test.tsx` — loading, sukses, 404, 403, aksi non-owner, dialog edit.
8. **Integration Workflows (`workspace-workflows.test.tsx`):**
   - **Workflow A:** Buat workspace dari dialog → respons 201 → sidebar diperbarui → navigasi ke detail → empty state.
   - **Workflow B:** Buka workspace → edit → PATCH → header detail berubah.
   - **Workflow C:** Buka workspace → arsip → konfirmasi → cache invalidated → navigasi aman ke `/inbox`.

Hasil akhir: **40 test file, 129 test, 100% PASS**. Coverage proyek: 88,84% statements, 84,30% branches, 92,09% functions, 88,63% lines. Semua test dijalankan dengan `bun run test:run`; tidak memakai snapshot sebagai pengganti assertion perilaku.

---

## G. Known Limitations & Backend Boundaries

1. **Delete Workspace Tidak Tersedia (Status: BLOCKED):**
   - Backend TodoIt-v2 tidak menyediakan endpoint hard delete (`DELETE /api/v1/workspaces/:workspaceId`).
   - Sesuai audit source code (`src/modules/workspace/infrastructure/persistence/workspace.schema.ts`), tabel `workspaces` hanya mendukung _soft archive_ via kolom `archived_at`.
   - Frontend tidak mengarang endpoint palsu atau operasi delete lokal; dekomisioning workspace dilakukan murni melalui fitur Archive Workspace (`POST /api/v1/workspaces/:workspaceId/archive`).
2. **Metadata Visual Kustom (Warna & Icon) Tidak Tersimpan di Backend:**
   - Skema backend hanya memiliki kolom `name` dan `description`.
   - Tidak ada kolom `color`, `icon`, atau `slug`.
   - Frontend tidak menampilkan picker warna/ikon palsu yang hilang saat reload, melainkan menurunkan inisial `mark` visual dari nama workspace.
3. **Restore Workspace Belum Didukung:**
   - Endpoint archive bersifat idempoten untuk mengarsipkan, tetapi backend belum memiliki endpoint `unarchive`/`restore`. Workspace yang diarsipkan tidak muncul di daftar aktif.
4. **Autentikasi End-to-End Belum Tersedia:**
   - Seluruh endpoint workspace memerlukan Bearer token. Login, penyimpanan token, dan refresh belum diimplementasikan pada Phase 1–3.
   - Layer API siap menerima `getAccessToken`, tetapi aplikasi belum dapat melakukan request terautentikasi tanpa phase autentikasi.
5. **Pagination Workspace:**
   - Backend membatasi maksimal 50 item per halaman. UI meminta `limit=50`; jika pengguna memiliki lebih dari 50 workspace, halaman berikutnya belum dimuat otomatis. Ini perlu ditangani bersama desain pagination pada phase lanjutan.
6. **Toast Global Belum Ada:**
   - Phase 2 belum menyediakan komponen toast. Feedback sukses saat ini berupa perubahan data, penutupan dialog, dan navigasi ke rute yang aman. Error ditampilkan inline di dialog/state halaman.
7. **Workspace Members Belum Diintegrasikan:**
   - Backend sudah memiliki endpoint member, tetapi Phase 3 hanya memakai `role` dari respons workspace untuk permission UI. Manajemen anggota tetap di luar cakupan Phase 3.
