# Keamanan JWT (Access Token Security)

Dokumen ini menjelaskan rancangan keamanan JSON Web Token (JWT) yang digunakan sebagai Access Token pada Todo Backend Application.

---

## 1. Spesifikasi Teknis JWT

- **Algoritma Signing**: **HS256** (HMAC dengan SHA-256).
- **Library Abstraction**: Menggunakan pustaka standar industri `jose` yang dibungkus di dalam `JoseAccessTokenService` pada Infrastructure layer. Domain dan Application layer tidak memiliki dependensi pada `jose`.
- **Secret Key Entropy**:
  - Dibaca dari variabel environment `AUTH_JWT_SECRET`.
  - Validator konfigurasi startup menolak secret yang lebih pendek dari 32 karakter (minimal 256-bit entropy) atau berupa placeholder tutorial (seperti `secret`, `123456`, `supersecret`).
  - Tidak ada fallback ke default secret hardcoded pada staging/production.

---

## 2. Struktur Payload Minimal

Untuk menjaga privasi dan performa, payload JWT dijaga sekecil mungkin:

```json
{
  "sub": "c1f7a83d-e6b3-4f9e-8c82-149b5c2a41d0",
  "sid": "f3b92044-8d91-4cf1-831c-529a738c82a1",
  "iss": "todo-backend",
  "aud": "todo-api",
  "iat": 1767225600,
  "exp": 1767226500
}
```

Informasi yang **Dilarang** dimasukkan ke dalam JWT:
- Password atau Password Hash.
- Refresh Token atau Token Hash.
- Kredensial database atau secret server.
- Informasi pribadi (PII) yang tidak esensial.

---

## 3. Masa Berlaku Pendek (Short TTL) & Verifikasi

- **Masa Berlaku (TTL)**: Default 15 menit (900 detik). Batas ini meminimalkan jendela eksploitasi jika token berhasil dicegat dari lalu lintas jaringan.
- **Validasi Wajib**:
  - `iss` (Issuer Validation): Wajib cocok dengan nilai konfigurasi (`AUTH_JWT_ISSUER`).
  - `aud` (Audience Validation): Wajib cocok dengan nilai konfigurasi (`AUTH_JWT_AUDIENCE`).
  - `exp` (Expiration Validation): Token kedaluwarsa otomatis ditolak oleh pustaka `jose`.
  - Signature Verification: Memverifikasi keutuhan token terhadap secret server.
  - Session Revocation Check: Middleware memverifikasi bahwa `sid` (Session ID) belum dicabut pada tabel `auth_sessions`.
