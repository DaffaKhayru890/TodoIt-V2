# ADR-0004: Workspace Ownership, Membership, dan Policy-Based Authorization

## Status
Diterima (Accepted)

## Konteks
Workspace adalah ruang lingkup kerja untuk mengorganisir daftar todo. Pada Phase 2, setiap workspace harus memiliki setidaknya satu pemilik (Owner). Satu pengguna dapat memiliki banyak workspace, dan ke depan (Phase 5) workspace akan dapat dibagikan kepada pengguna lain dengan berbagai role (Admin, Member).

Terdapat kebutuhan:
1. Memastikan integritas kepemilikan: workspace tidak boleh ada tanpa owner.
2. Mencegah eskalasi hak akses atau kebocoran data antar pengguna (data isolation).
3. Memastikan otorisasi tidak hardcoded di HTTP controller, melainkan di domain/application policy yang independen dari framework.
4. Mencegah enumerasi resource ID oleh pihak yang tidak berhak.

## Keputusan
1. **Pembuatan Atomik Workspace dan Membership**:
   - Pembuatan workspace dan keanggotaan pembuat sebagai `OWNER` dieksekusi di dalam satu transaksi database PostgreSQL.
   - Apabila penyisipan keanggotaan gagal, pembuatan workspace otomatis dibatalkan (rollback).
2. **Role Enums dan Matriks Hak Akses**:
   - Role keanggotaan terdiri dari `OWNER`, `ADMIN`, dan `MEMBER` (disimpan sebagai varchar dengan database check constraint).
   - Otorisasi diimplementasikan dalam `WorkspaceAuthorizationPolicy`:
     - **View Workspace**: Diizinkan untuk Owner, Admin, Member.
     - **Update Workspace**: Hanya Owner.
     - **Archive Workspace**: Hanya Owner.
3. **Anti-Enumeration 404 Response**:
   - Jika pengguna meminta workspace yang bukan haknya atau resource tidak ada, sistem selalu mengembalikan kode `WORKSPACE_ACCESS_DENIED` yang dipetakan ke **HTTP 404 Not Found** (bukan 403 Forbidden).
   - Kode HTTP 403 hanya digunakan ketika resource diketahui ada bagi pengguna namun role spesifik pengguna tidak memenuhi syarat (misalnya Member mencoba mengupdate workspace).
4. **Soft Archive Lifecycle**:
   - Workspace yang diarsipkan tidak dihapus secara permanen dari database, melainkan diberi cap waktu `archived_at`.
   - Listing workspace aktif menyaring `archived_at IS NULL`.
   - Pengarsipan bersifat idempoten.

## Konsekuensi
### Positif
- Integritas data terjamin: tidak ada workspace yatim tanpa pemilik.
- Clean Architecture terjaga: logika otorisasi dapat diuji secara mandiri tanpa memerlukan Elysia atau HTTP context.
- Privasi data pengguna terlindungi dari scanning ID (anti-enumeration).
- Mempersiapkan fondasi yang solid untuk kolaborasi multi-user di Phase 5.
