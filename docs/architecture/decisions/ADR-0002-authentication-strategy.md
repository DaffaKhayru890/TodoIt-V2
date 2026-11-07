# ADR-0002: Strategi Autentikasi Menggunakan Dual Token (JWT & Opaque Refresh Token)

## Status
Diterima (Accepted)

## Konteks
Aplikasi Todo Backend membutuhkan mekanisme autentikasi yang aman, scalable, dan mendukung banyak perangkat (multi-session). Terdapat kebutuhan untuk:
1. Meminimalkan beban query database pada setiap request API yang terlindungi.
2. Memastikan session dapat dicabut sewaktu-waktu (revocation), misalnya saat logout atau ketika kredensial dicurigai bocor.
3. Menghindari kerentanan penyimpanan token di sisi klien (XSS) dan serangan CSRF.

## Keputusan
Kami mengadopsi pola **Dual Token Authentication**:
1. **Access Token (Stateless JWT)**:
   - Algoritma: HS256 dengan secret minimal 32 byte entropy.
   - Masa berlaku pendek: 15 menit (900 detik).
   - Payload minimal: `sub` (User ID), `sid` (Session ID), `iss`, `aud`, `iat`, `exp`.
   - Dikirimkan pada header `Authorization: Bearer <token>`.
   - Diperiksa bersama status keaktifan session pada middleware request guard.
2. **Refresh Token (Stateful Opaque Token)**:
   - Berupa 32 byte cryptographically secure random bytes (256-bit entropy) base64url.
   - Hanya SHA-256 hash yang disimpan di database; token plaintext tidak pernah disimpan secara persisten.
   - Masa berlaku panjang: 30 hari (2.592.000 detik).
   - Dikirimkan ke klien secara eksklusif melalui `HttpOnly` cookie dengan proteksi `SameSite=lax` (atau `strict`) dan `Secure` pada environment staging/production.
3. **Password Hashing**:
   - Menggunakan Bun.password dengan algoritma **Argon2id**.
   - Timing equalizer hash untuk menjaga waktu respons tetap identik saat email tidak ditemukan.

## Konsekuensi
### Positif
- Akses cepat untuk operasi baca/tulis rutin dengan JWT yang terverifikasi.
- Token refresh terlindung dari akses JavaScript di browser berkat `HttpOnly` cookie.
- Database tidak menyimpan plaintext token, sehingga kebocoran database tidak langsung membocorkan session aktif.
- Mendukung pencabutan akses perangkat secara terisolasi.

### Negatif / Mitigasi
- Memerlukan koordinasi session lookup untuk memverifikasi apakah session telah dicabut.
- Memerlukan mekanisme rotasi token dan deteksi reuse token yang ketat (dibahas pada ADR-0003).
