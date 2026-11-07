# Health check

`GET /health` dan `GET /health/live` menjawab bahwa proses API hidup tanpa menyentuh database.

`GET /ready` menjalankan `SELECT 1` dengan timeout yang sudah ada. Respons tidak memuat host, user, atau password.

Worker menulis `worker_heartbeats` setiap siklus scheduler. Tidak ada endpoint publik untuk heartbeat. Operator membaca tabel itu.
