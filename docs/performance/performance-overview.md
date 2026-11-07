# Ikhtisar performa

Optimasi yang masuk ke kode: pool database dapat dikonfigurasi, `statement_timeout` dan `query_timeout` mengikuti `DATABASE_STATEMENT_TIMEOUT_MS`, SMTP punya connection timeout, dan server memakai `idleTimeout` Bun.

Index cursor dan antrean dari fase sebelumnya tidak diubah. Tidak ada index baru pada fase ini karena tidak ada bukti `EXPLAIN` yang menunjukkan kebutuhan index tambahan di luar yang sudah ada.

Angka beban jaringan tidak diukur. Skrip k6 ada di `tests/load` dan belum dijalankan di mesin ini karena k6 tidak diverifikasi terpasang.
