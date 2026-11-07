# Dokumentasi API Autentikasi

Base URL: `/api/v1/auth`

Modul Autentikasi menyediakan endpoint pendaftaran akun, masuk (login), rotasi refresh token, keluar (logout), dan pengambilan profil pengguna terautentikasi.

---

## 1. Register User

Mendaftarkan akun pengguna baru. Email akan dinormalisasi secara otomatis (lowercase dan trim).

- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Auth**: None

### Request Body
```json
{
  "email": "developer@example.com",
  "displayName": "Developer",
  "password": "a-secure-long-passphrase"
}
```

### Response
**Status 201 Created**:
```json
{
  "user": {
    "id": "c1f7a83d-e6b3-4f9e-8c82-149b5c2a41d0",
    "email": "developer@example.com",
    "displayName": "Developer",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### Error Responses
- **409 Conflict**: `EMAIL_ALREADY_EXISTS` ("Email sudah terdaftar.")
- **422 Unprocessable Content**: `VALIDATION_ERROR` (format email tidak valid, password < 12 atau > 128 karakter)

---

## 2. Login User

Autentikasi kredensial pengguna. Mengembalikan JWT Access Token dan menyetel Refresh Token pada HttpOnly cookie.

- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Auth**: None

### Request Body
```json
{
  "email": "developer@example.com",
  "password": "a-secure-long-passphrase"
}
```

### Response
**Status 200 OK**:
```json
{
  "user": {
    "id": "c1f7a83d-e6b3-4f9e-8c82-149b5c2a41d0",
    "email": "developer@example.com",
    "displayName": "Developer"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

**Set-Cookie Header**:
```http
Set-Cookie: todo_refresh=<opaque_token>; Path=/api/v1/auth; HttpOnly; SameSite=lax; Max-Age=2592000
```

### Error Responses
- **401 Unauthorized**: `INVALID_CREDENTIALS` ("Invalid email or password") — respon identik untuk password salah maupun email tidak ditemukan.

---

## 3. Refresh Access Token

Memperbarui JWT Access Token dengan merotasi Refresh Token yang dikirimkan melalui cookie.

- **Method**: `POST`
- **Path**: `/api/v1/auth/refresh`
- **Auth**: `todo_refresh` cookie

### Request
Memerlukan cookie `todo_refresh`.

### Response
**Status 200 OK**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

**Set-Cookie Header**:
Refresh token baru disetel menggantikan token sebelumnya.

### Error Responses
- **401 Unauthorized**: `INVALID_REFRESH_TOKEN` (token tidak valid, sudah expired, atau terdeteksi reuse).

---

## 4. Logout User

Mencabut sesi aktif yang berasosiasi dengan refresh token dan menghapus cookie klien.

- **Method**: `POST`
- **Path**: `/api/v1/auth/logout`
- **Auth**: `todo_refresh` cookie

### Response
**Status 204 No Content** (tanpa body).

**Set-Cookie Header**:
```http
Set-Cookie: todo_refresh=; Path=/api/v1/auth; Max-Age=0
```

---

## 5. Get Current User

Mengambil profil pengguna yang sedang terautentikasi berdasarkan JWT Access Token.

- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Auth**: `Authorization: Bearer <accessToken>`

### Response
**Status 200 OK**:
```json
{
  "user": {
    "id": "c1f7a83d-e6b3-4f9e-8c82-149b5c2a41d0",
    "email": "developer@example.com",
    "displayName": "Developer"
  }
}
```

### Error Responses
- **401 Unauthorized**: `INVALID_ACCESS_TOKEN`, `SESSION_REVOKED`, atau `SESSION_EXPIRED`.
