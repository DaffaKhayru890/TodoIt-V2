# Tes konkurensi

Klaim job oleh dua worker dan lease yang kedaluwarsa tetap diuji di tes notifikasi, termasuk PostgreSQL `SKIP LOCKED`. Rotasi refresh dan undangan konkuren tetap di tes fase sebelumnya.

`bun run test:concurrency` menjalankan berkas itu.
