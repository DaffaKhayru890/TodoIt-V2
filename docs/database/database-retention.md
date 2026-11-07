# Retensi data

Job `completed` default 14 hari. Job `failed` default 90 hari. Perintah `bun run notifications:cleanup` menghapus hanya status itu. `pending` dan `processing` tidak dihapus. `--dry-run` hanya menghitung.

Audit default 365 hari sebagai keputusan produk, bukan kewajiban hukum. Session dan refresh token mengikuti TTL yang sudah ada. Undangan mengikuti TTL undangan.

Pembersihan audit otomatis belum dijadikan perintah.
