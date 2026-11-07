# Rollback

Rollback aplikasi aman bila image sebelumnya tidak membutuhkan kolom yang sudah dihapus. Fase ini tidak menghapus kolom. Kembalikan API dan worker ke digest image sebelumnya setelah memastikan image itu kompatibel dengan skema yang sudah terpasang.

Jangan menghapus tabel `0005` sebagai rollback otomatis. Data audit akan hilang.
