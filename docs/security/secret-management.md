# Pengelolaan secret

Secret yang dikenal: password database, JWT, secret JWT sebelumnya, dan password SMTP.

Tidak ada secret production di source, contoh env, atau image. Startup production gagal bila password development, user `root`/`postgres`/`admin`, atau database tanpa SSL dipakai.

Rotasi JWT: isi secret baru di `AUTH_JWT_SECRET` dan pindahkan secret lama ke `AUTH_JWT_PREVIOUS_SECRETS`. Token yang masih berlaku tetap dapat diverifikasi. Secret lama boleh dihapus setelah access token terlama kedaluwarsa. Refresh token tidak bergantung pada JWT secret karena disimpan sebagai hash.

Rotasi password database dan SMTP membutuhkan restart proses setelah environment diganti. Session tidak otomatis tercabut saat secret JWT berganti selama secret lama masih ada di daftar previous.
