# Dokumentasi Pengujian Modul Autentikasi

Dokumen ini mendokumentasikan strategi pengujian, cakupan test case, dan hasil verifikasi untuk modul Autentikasi dan Session Management.

---

## 1. Struktur dan Piramida Pengujian

Pengujian modul autentikasi dibagi ke dalam dua tingkatan:
1. **Unit Tests (In-Memory)**:
   - Lokasi: `tests/unit/auth/`
   - Berjalan super cepat tanpa memerlukan koneksi jaringan atau database eksternal.
   - Menggunakan `InMemoryAuthRepository` dan fake implementation untuk `PasswordHasher`, `AccessTokenService`, `RefreshTokenGenerator`, dan `Clock`.
2. **Integration Tests (HTTP & Database Nyata)**:
   - Lokasi: `tests/integration/auth-endpoints.test.ts` dan `tests/integration/auth-database.test.ts`
   - Menguji interaksi HTTP menyeluruh via `app.handle()` dan transaksi row-level locking pada PostgreSQL nyata.

---

## 2. Cakupan Skenario Pengujian

### 2.1 Register User (`tests/unit/auth/register-user.test.ts`)
- Registrasi dengan data valid menghasilkan output DTO yang benar.
- Email tidak valid ditolak (`INVALID_EMAIL`).
- Email duplikat ditolak (`EMAIL_ALREADY_EXISTS`).
- Password terlalu pendek (< 12 karakter) ditolak.
- Password terlalu panjang (> 128 karakter) ditolak.
- Password tidak tersimpan sebagai plaintext (tersimpan dalam bentuk hash).
- Email dinormalisasi (lowercase dan trim).
- Kegagalan repository menyimpan user meneruskan exception secara aman.

### 2.2 Login User (`tests/unit/auth/login-user.test.ts`)
- Login valid menghasilkan access token dan refresh token cookie.
- Password salah menghasilkan `INVALID_CREDENTIALS`.
- Email tidak ditemukan menghasilkan error `INVALID_CREDENTIALS` yang identik (pencegahan enumerasi email).
- Login email bersifat case-insensitive.
- Sesi baru tercatat di repository bersama metadata User-Agent.

### 2.3 Refresh Session & Rotation (`tests/unit/auth/refresh-session.test.ts`)
- Refresh token valid merotasikan token dan menghasilkan access token baru.
- Refresh token invalid / null ditolak (`INVALID_REFRESH_TOKEN`).
- Refresh token expired ditolak.
- Sesi yang dicabut ditolak (`SESSION_REVOKED`).
- Deteksi token reuse: penggunaan token lama yang sudah dikonsumsi memicu pencabutan seluruh sesi milik user terkait.

### 2.4 Logout User (`tests/unit/auth/logout-user.test.ts`)
- Logout sesi aktif mencabut sesi dan refresh token.
- Logout dengan token invalid aman dan idempoten (tidak melempar error).
- Logout dua kali berturut-turut aman dan idempoten.

### 2.5 Get Current User (`tests/unit/auth/get-current-user.test.ts`)
- Access token valid mengembalikan data user dan memperbarui timestamp `lastUsedAt`.
- Token expired atau invalid ditolak (`INVALID_ACCESS_TOKEN`).
- Sesi yang dicabut ditolak (`SESSION_REVOKED`).
- Sesi yang kedaluwarsa ditolak (`SESSION_EXPIRED`).
- User yang tidak ditemukan di repository ditolak (`USER_NOT_FOUND`).

### 2.6 Database & Concurrency (`tests/integration/auth-database.test.ts`)
- Constraint unique email pada tabel `users` PostgreSQL.
- Transaksi atomik rotasi refresh token.
- Concurrency test: dua request rotasi simultan menggunakan token yang sama pada PostgreSQL nyata; tepat satu request yang berhasil dirotasi, sementara request kedua terdeteksi sebagai reuse dan mencabut seluruh sesi.
