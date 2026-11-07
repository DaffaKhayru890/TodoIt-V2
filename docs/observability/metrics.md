# Metrik

`InProcessMetrics` menyimpan counter di memori proses. Nama yang dipakai antara lain `http.requests`, `http.status.*`, `http.rate_limited`, dan durasi bila `observe` dipanggil. User id, todo id, dan job id tidak menjadi label.

Tidak ada endpoint publik `/metrics`. Snapshot dapat dibaca dari proses yang memegang instance. Integrasi Prometheus belum dipasang. Keterbatasan ini disengaja agar tidak menambah dependency sebelum ada backend monitoring yang dipilih.
