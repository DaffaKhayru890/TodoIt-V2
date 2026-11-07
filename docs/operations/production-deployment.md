# Deployment Production

Satu image membangun `dist/main.js` dan `dist/worker.js`. API memakai command bawaan `bun run dist/main.js`. Worker menimpa command menjadi `bun run dist/worker.js`.

Keduanya memakai user non-root, tidak menyalin `.env` ke image, dan membaca environment dari platform. PostgreSQL persisten dipakai bersama. Beberapa replika worker aman karena klaim memakai `SKIP LOCKED`.

Mailpit tidak dijalankan di production. Worker tidak dinyalakan di dalam proses API. Healthcheck image memeriksa HTTP API; worker dipantau lewat log proses dan keberadaannya di database, bukan lewat dump antrean publik.

Sinyal stop platform harus sampai sebagai `SIGTERM` agar shutdown worker melepas lease.
