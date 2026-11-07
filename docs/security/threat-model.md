# Threat model

Aset: password hash, refresh token hash, invitation token hash, data workspace, antrean job, dan secret SMTP.

| Ancaman | Mitigasi di kode |
| --- | --- |
| Credential stuffing | Rate limit auth, respons login seragam, Argon2id |
| Pencurian refresh token | HttpOnly, Secure di production, rotasi, reuse detection yang sudah ada |
| CSRF pada cookie | SameSite dan pemeriksaan Origin untuk refresh serta logout |
| BOLA | Membership dibaca ulang dari database pada use case workspace dan todo |
| SQL injection | Query Drizzle dan SQL berparameter |
| Kebocoran secret | Logger redaction, image tanpa `.env`, contoh env tanpa rahasia nyata |
| Job ganda | Idempotency key dan `SKIP LOCKED` |
| Worker berbahaya | Tidak ada endpoint publik untuk antrean |

Ancaman yang tetap membutuhkan kontrol di luar proses: TLS di proxy, firewall database, dan rotasi secret di platform.
