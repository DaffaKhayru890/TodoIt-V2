# Keamanan Token Undangan

Token adalah opaque random 32 byte (256 bit) dalam base64url, dari API acak yang sama dengan refresh token. Token tidak dibentuk dari user id atau waktu dan bukan JWT.

Database menyimpan SHA-256 hex. Response API, pesan error, dan log aplikasi tidak memuat token mentah maupun hash. URL email memakai fragment:

```text
{WEB_APP_URL}/invitations/accept#token=RAW_TOKEN
```

Fragment tidak dikirim ke server sebagai query. Frontend harus:

1. Membaca token dari fragment.
2. Menghapus fragment dari history.
3. Mengirim token di body `POST /invitations/:id/accept` atau `decline`.
4. Tidak menyimpan token di localStorage.
5. Tidak mengirim token ke analytics.

Accept dan decline mewajibkan pengguna login. Email akun harus sama dengan `normalizedEmail`. Role anggota diambil dari undangan, bukan dari body.

Token langsung tidak valid setelah accept, decline, revoke, atau resend. Resend mengganti hash sebelum email baru dikirim. Undangan yang lewat `expiresAt` tidak bisa diterima.
