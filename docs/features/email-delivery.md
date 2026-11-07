# Pengiriman Email

Undangan dan notifikasi memakai `src/shared/infrastructure/email/smtp-transport.ts`. Application notification hanya mengenal `NotificationEmailSender`.

Template punya subjek sama dengan judul, versi teks, versi HTML, nama todo, pesan, konteks workspace, dan tautan yang disusun dari `WEB_APP_URL` plus id todo dan workspace. URL klien tidak dipakai sebagai redirect.

Message-ID stabil: `<notification.{notificationId}@todo-backend>`.

Kode SMTP 5xx dipetakan ke `SMTP_PERMANENT` dan langsung `failed`. Kegagalan lain dipetakan ke `SMTP_TEMPORARY` dan di-retry. Exception mentah tidak dikembalikan ke klien dan tidak ditulis ke log bersama password.

Alur: dispatch membuat notification, lalu job email bila perlu. Worker mengklaim job itu, mengirim SMTP di luar transaksi, lalu complete, retry, atau fail. Gagal email tidak menghapus notification.
