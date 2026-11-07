# Arsitektur Modul Otorisasi

Dokumen ini menjelaskan strategi otorisasi, pemisahan tanggung jawab antara identitas (authentication) dan hak akses (authorization), serta implementasi role-based access control pada Workspace Module.

---

## 1. Pemisahan Autentikasi vs Otorisasi

Pada Todo Backend Application:
- **Autentikasi (Authentication)** menjawab: *"Siapa Anda?"*
  - Mengonfirmasi identitas pengguna melalui kredensial (email & password) atau cryptographic token (JWT Access Token).
  - Hasil autentikasi adalah objek konteks pengguna terpercaya: `AuthenticatedUser { id, email, displayName }`.
  - Tidak menentukan operasi apa saja yang boleh dijalankan pada resource bisnis.
- **Otorisasi (Authorization)** menjawab: *"Apakah Anda berhak melakukan tindakan ini pada resource ini?"*
  - Berlangsung setelah identitas diverifikasi.
  - Memeriksa keanggotaan pengguna di dalam workspace dan role yang dimilikinya (`Owner`, `Admin`, `Member`).

---

## 2. Batas Arsitektural (Authorization Boundaries)

Aturan utama dalam implementasi otorisasi:
1. **Tidak Ada Business Logic Otorisasi di Middleware Elysia**:
   - Middleware/Guard Elysia (`createAuthGuard`) hanya bertugas menegakkan autentikasi dan menyediakan objek `user` terautentikasi.
   - Keputusan apakah user berhak mengubah atau mengarsipkan workspace berada di Use Case dan Policy layer.
2. **Tidak Percaya User ID dari Body/Query**:
   - Identitas pengguna selalu diambil dari `user.id` yang dihasilkan verifikasi token.
   - Endpoint tidak pernah menerima `userId` sebagai payload klien untuk menentukan pemilik resource.
3. **Penyembunyian Informasi (Anti-Resource Enumeration)**:
   - Jika pengguna mencoba mengakses workspace yang tidak ia miliki/ikuti, sistem merespons dengan **HTTP 404 (WORKSPACE_ACCESS_DENIED)**, bukan HTTP 403.
   - Pendekatan ini mencegah penyerang melakukan pemindaian (enumeration) terhadap UUID workspace pengguna lain.

---

## 3. Matriks Hak Akses Workspace (Permission Matrix)

Berikut adalah matriks otorisasi berbasis peran (Role-Based Authorization):

| Aksi / Izin | Owner | Admin (Reserved) | Member (Reserved) |
|---|---|---|---|
| **View Workspace** | Yes | Yes | Yes |
| **Update Workspace** | Yes | No | No |
| **Archive Workspace** | Yes | No | No |
| **Invite Member** | Reserved (Phase 5) | Reserved (Phase 5) | No |
| **Remove Member** | Reserved (Phase 5) | Reserved (Phase 5) | No |
| **Change Member Role** | Reserved (Phase 5) | Reserved (Phase 5) | No |

*Catatan: Pada Phase 2, hanya role `OWNER` yang aktif dibuat secara otomatis untuk pembuat workspace. Role `ADMIN` dan `MEMBER` telah didefinisikan pada enum dan skema database sebagai fondasi untuk fitur kolaborasi Phase 5.*

---

## 4. Implementasi Policy Independen

Otorisasi didefinisikan dalam `WorkspaceAuthorizationPolicy` di Domain/Application layer:

```typescript
export class WorkspaceAuthorizationPolicy {
  static canPerform(role: WorkspaceRole | null | undefined, action: WorkspaceAction): boolean {
    if (!role) return false;

    switch (action) {
      case WorkspaceAction.VIEW:
        return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN || role === WorkspaceRole.MEMBER;
      case WorkspaceAction.UPDATE:
      case WorkspaceAction.ARCHIVE:
        return role === WorkspaceRole.OWNER;
      default:
        return false;
    }
  }
}
```

Implementasi ini murni berbasis data (POJO) tanpa dependensi pada framework HTTP, sehingga seluruh skenario izin dapat diuji secara unit test dengan cepat dan andal.
