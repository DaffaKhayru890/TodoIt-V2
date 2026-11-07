# Tes keamanan

`tests/security/http-hardening.test.ts` memeriksa penolakan origin, batas body, rate limit, pengabaian `X-Forwarded-For` tanpa trusted proxy, dan redaksi log.

Tes BOLA, JWT, dan refresh reuse dari fase sebelumnya tidak dihapus.
