# Penguatan autentikasi

Password memakai Argon2id melalui API Bun dan tidak dikembalikan API. JWT hanya HS256, dengan issuer, audience, dan expiry. Algoritma lain ditolak oleh `algorithms: ['HS256']`.

Session yang revoked atau kedaluwarsa membuat access token ditolak di `GetCurrentUser`.

Cookie refresh: HttpOnly, path `/api/v1/auth`, Secure wajib di staging dan production, SameSite dari konfigurasi. Permintaan refresh dan logout dengan header Origin di luar allowlist ditolak.

Rotasi secret yang kompatibel dijelaskan di secret-management.
