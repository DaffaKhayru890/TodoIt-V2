# Keamanan Refresh Token (Refresh Token Security)

Dokumen ini mendokumentasikan spesifikasi keamanan token opaque, rotasi token, dan deteksi penyalahgunaan (token reuse detection) pada Todo Backend Application.

---

## 1. Pembangkitan Token Opaque Berkualitas Kriptografis

Refresh token bukan JWT, melainkan **cryptographically secure random opaque token**:
- Dihasilkan dari 32 byte (256-bit) entropy acak menggunakan Web Crypto / Node.js cryptographic APIs.
- Di-encode ke dalam format `base64url`.
- Tidak mengandung timestamp, user ID, atau data yang dapat ditebak.

---

## 2. Penyimpanan Berbasis Hash SHA-256

- Server **tidak pernah** menyimpan refresh token dalam bentuk plaintext pada database.
- Sebelum disimpan ke tabel `refresh_tokens`, token di-hash secara deterministik menggunakan **SHA-256** dan direpresentasikan sebagai string hexadecimal lowercase.
- Saat klien mengirimkan refresh token, hash dihitung ulang untuk lookup record database.
- Kebocoran isi database tidak akan membocorkan refresh token aktif yang dapat digunakan penyerang.

---

## 3. Refresh Token Rotation & Concurrency Control

Setiap kali klien meminta token baru:
1. Token lama diverifikasi masa berlakunya dan status konsumsinya.
2. Di dalam transaksi database PostgreSQL dengan kunci `SELECT ... FOR UPDATE`, token lama ditandai `consumed_at = now()`.
3. Token baru digenerate, di-hash, dan disimpan dengan `replaced_by_token_id` menunjuk token pengganti.
4. Token baru dikirimkan kembali ke klien melalui cookie.

---

## 4. Deteksi Token Reuse (Automatic Revocation)

Jika penyerang mencuri token yang telah dikonsumsi (atau sebaliknya penyerang telah merotasi token sebelum korban melakukan refresh):
- Sistem mendeteksi `consumed_at !== null` atau `replaced_by_token_id !== null`.
- Dalam transaksi yang sama, sistem langsung:
  1. Menandai seluruh sesi aktif milik user terkait sebagai dicabut (`revoked_at = now()`).
  2. Mencatat peringatan insiden keamanan ke structured log.
  3. Mengembalikan error autentikasi generik (`INVALID_REFRESH_TOKEN`).

---

## 5. Keamanan Cookie & CORS

Refresh token dikirimkan secara eksklusif via cookie dengan konfigurasi keamanan:
- **`HttpOnly`**: Mencegah script klien (JavaScript / XSS) membaca atau mencuri isi cookie.
- **`Secure`**: Wajib `true` pada staging dan production; cookie hanya dikirim melalui koneksi terenkripsi HTTPS.
- **`SameSite`**: Dikonfigurasi `lax` (atau `strict`) untuk mencegah serangan Cross-Site Request Forgery (CSRF).
- **`Path`**: Dibatasi hanya pada `/api/v1/auth`, sehingga browser tidak mengirimkan cookie refresh pada request API umum lainnya.
- **CORS Allowlist**: CORS origins dibatasi secara ketat pada allowlist eksplisit (`CORS_ALLOWED_ORIGINS`). Penggunaan wildcard origin (`*`) ditolak oleh startup validator saat kredensial/cookie aktif.
