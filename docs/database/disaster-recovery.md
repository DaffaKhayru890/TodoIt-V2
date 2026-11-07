# Pemulihan bencana

Hentikan tulisan baru bila kerusakan masih berjalan. Pilih backup. Pulihkan ke database terisolasi. Periksa tabel, foreign key, dan `drizzle.__drizzle_migrations`. Baru setelah itu putuskan pemotongan traffic.

WAL archiving dan point-in-time recovery tidak dikonfigurasi di repository ini. Keduanya membutuhkan dukungan operator database.
