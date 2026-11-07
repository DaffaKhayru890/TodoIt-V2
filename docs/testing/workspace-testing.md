# Dokumentasi Pengujian Modul Workspace

Dokumen ini mendokumentasikan strategi pengujian, cakupan test case, dan hasil verifikasi untuk Workspace Module.

---

## 1. Struktur Pengujian

Modul workspace diuji secara ketat pada level domain, use case, HTTP integration, dan database transaksi:
1. **Unit Tests (In-Memory)**:
   - Lokasi: `tests/unit/workspace/`
   - Menggunakan `InMemoryWorkspaceRepository` untuk menguji business rules, validasi nama/deskripsi, paginasi, soft archive, dan otorisasi independen.
2. **Integration Tests (HTTP & Database Nyata)**:
   - Lokasi: `tests/integration/workspace-endpoints.test.ts` dan `tests/integration/workspace-database.test.ts`
   - Menguji interaksi Elysia HTTP handler, middleware auth guard, skema validasi, serta transaksi atomik PostgreSQL.

---

## 2. Cakupan Skenario Pengujian

### 2.1 Create Workspace (`tests/unit/workspace/create-workspace.test.ts`)
- Data valid menghasilkan workspace baru dan pembuat otomatis menjadi `OWNER`.
- Validasi nama: nama kosong atau hanya whitespace ditolak (`WORKSPACE_NAME_INVALID`).
- Validasi nama: nama > 100 karakter ditolak.
- Validasi deskripsi: deskripsi > 500 karakter ditolak.
- Uji rollback transaksi: kegagalan saat insert membership membatalkan seluruh pembuatan workspace secara atomik.

### 2.2 List Workspaces (`tests/unit/workspace/list-workspaces.test.ts`)
- Hanya mengembalikan workspace di mana pengguna terdaftar sebagai member.
- Tidak pernah menampilkan workspace milik pengguna lain (data isolation).
- Workspace yang telah diarsipkan tidak muncul dalam daftar aktif.
- Paginasi: nilai default `limit=20` dan `offset=0`.
- Paginasi: pembatasan limit maksimal ke 50.
- Paginasi: penggeseran data sesuai parameter offset.

### 2.3 Get Workspace Detail (`tests/unit/workspace/get-workspace.test.ts`)
- Mengembalikan detail lengkap jika pengguna terdaftar sebagai anggota.
- Pengguna bukan anggota ditolak dengan `WORKSPACE_ACCESS_DENIED` (HTTP 404 anti-enumeration).
- Workspace tidak ada ditolak dengan `WORKSPACE_ACCESS_DENIED`.
- Workspace yang telah diarsipkan ditolak dengan `WORKSPACE_ACCESS_DENIED`.

### 2.4 Update Workspace (`tests/unit/workspace/update-workspace.test.ts`)
- Owner berhasil memperbarui nama dan deskripsi.
- Member biasa ditolak dengan `WORKSPACE_PERMISSION_DENIED` (HTTP 403).
- Pengguna asing ditolak dengan `WORKSPACE_ACCESS_DENIED` (HTTP 404).
- Request kosong (tanpa field name maupun description) ditolak.
- Validasi field: nama kosong atau deskripsi > 500 karakter ditolak.

### 2.5 Archive Workspace (`tests/unit/workspace/archive-workspace.test.ts`)
- Owner berhasil mengarsipkan workspace (`archivedAt` tercatat).
- Pengarsipan bersifat idempoten: panggilan berulang mengembalikan status sukses dan timestamp asli.
- Member biasa ditolak dengan HTTP 403 (`WORKSPACE_PERMISSION_DENIED`).
- Pengguna asing ditolak dengan HTTP 404 (`WORKSPACE_ACCESS_DENIED`).

### 2.6 Database & Transaksi Nyata (`tests/integration/workspace-database.test.ts`)
- Pembuatan atomik workspace dan keanggotaan `OWNER` pada PostgreSQL nyata.
- Verifikasi relasi join `findWorkspaceWithRole`.
- Verifikasi filtering `archivedAt IS NULL` pada query Drizzle nyata.
