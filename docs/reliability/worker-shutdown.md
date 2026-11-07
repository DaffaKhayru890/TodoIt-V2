# Shutdown Worker

Sinyal `SIGINT` dan `SIGTERM` meminta loop berhenti. Scheduler tidak memulai siklus baru dan klaim baru tidak dilakukan. Job yang sudah masuk `process` ditunggu sampai grace period, yaitu minimum 15 detik dan durasi lease.

Job yang belum selesai tidak dipaksa completed. Lease worker dilepas, pool ditutup, proses keluar.

Database yang sesaat tidak tersedia dicatat sebagai `worker poll failed` dengan nama error saja, lalu loop tidur sesuai interval poll dan mencoba lagi. Satu kegagalan poll tidak menghapus job.
