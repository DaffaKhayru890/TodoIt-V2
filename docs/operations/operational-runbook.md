# Runbook

API tidak menjawab: lihat status container, log JSON, `/health`, lalu `/ready`. Jika `/health` hidup dan `/ready` 503, periksa database.

Database tidak tersedia: periksa koneksi, pool, kredensial, dan jaringan. Jangan mencetak password ke tiket.

Worker diam: baca `worker_heartbeats.last_seen_at`, job `processing` yang `lock_expires_at` sudah lewat, dan log `worker poll failed`.

Antrean menumpuk: hitung pending, lihat konkurensi worker, dan kegagalan SMTP. Inbox tetap ada bila email gagal.

SMTP gagal: periksa host, TLS, dan kode error job. Jangan menyalin password SMTP ke log.

Rahasia bocor: ikuti security-incident-response.

Kehilangan data: ikuti disaster-recovery. Jangan menjalankan restore ke production tanpa persetujuan.
