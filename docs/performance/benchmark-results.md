# Hasil benchmark

Uji k6 belum dijalankan. Tidak ada angka latensi jaringan.

Pengukuran in-process pada mesin pengembangan, 500 panggilan `app.handle` ke `GET /health` tanpa database, menghasilkan total 32.22 ms, rata-rata 0.064 ms, P50 0.011 ms, P95 0.051 ms, P99 0.838 ms, 0 error. Angka itu hanya biaya handler di proses yang sama, bukan throughput production.
