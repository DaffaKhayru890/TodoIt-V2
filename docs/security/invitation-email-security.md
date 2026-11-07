# Keamanan Email Undangan

Use case hanya mengenal port `InvitationEmailSender`. Nodemailer berada di `SmtpInvitationEmailSender`.

Email memuat nama workspace, nama pengundang, role, tautan fragment, dan waktu kedaluwarsa, dalam HTML dan teks biasa. Subjek: `You have been invited to a Todo Workspace`. Penerima adalah email ternormalisasi. URL dibangun dari `WEB_APP_URL` konfigurasi, bukan dari body klien.

Log keberhasilan hanya memuat nama workspace dan role. Log kegagalan hanya memuat nama error. Password SMTP, token, dan URL tidak ditulis.

`deliveryStatus` terpisah dari status undangan. Gagal kirim tidak mengubah undangan menjadi accepted atau revoked. Pesan SMTP mentah tidak dikembalikan ke klien.

Development memakai Mailpit tanpa TLS (`SMTP_SECURE=false`, port 1025). Production dan staging mewajibkan `WEB_APP_URL` HTTPS serta `SMTP_HOST` dan `SMTP_FROM` terisi. Kredensial datang dari environment, tidak di-hardcode dan tidak masuk image Docker.
