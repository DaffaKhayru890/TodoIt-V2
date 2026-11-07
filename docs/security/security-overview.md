# Ikhtisar keamanan

Audit memakai OWASP API Security Top 10 2023 dan OWASP ASVS 4.0.3 sebagai referensi, bukan sebagai sertifikasi.

Kontrol yang ada di kode:

- Argon2id lewat Bun.password.
- JWT HS256 dengan issuer, audience, dan expiry. Secret lama dapat memverifikasi token lewat `AUTH_JWT_PREVIOUS_SECRETS`. Penandatanganan memakai secret saat ini.
- Access token ditolak bila session dicabut.
- Refresh token opaque, disimpan sebagai hash, dirotasi, dan cookie dibatasi ke `/api/v1/auth`.
- Origin yang tidak ada di allowlist ditolak untuk refresh dan logout.
- CORS menolak wildcard.
- Production menolak user database `root`, password development, SMTP localhost, cookie tidak Secure, dan `DATABASE_SSL=false`.
- Header `nosniff`, `no-referrer`, dan `DENY`. HSTS hanya bila `SECURITY_HSTS=true`.
- Body dibatasi `Content-Length`. Rate limit kategori memakai PostgreSQL.
- Log meredaksi field password, token, cookie, dan authorization.

Temuan dan status ada di [security-audit.md](security-audit.md).
