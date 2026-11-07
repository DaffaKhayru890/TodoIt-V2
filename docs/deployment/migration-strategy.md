# Strategi migrasi

Migrasi bersifat expand. `0005` hanya menambah tabel. Migrasi dijalankan satu kali oleh job rilis, bukan oleh setiap replika API atau worker. `src/main.ts` dan `src/worker.ts` tidak memanggil drizzle migrate.

Rollback skema yang sudah menambah tabel tidak disediakan sebagai down migration. Perbaikan maju adalah migration berikutnya. Aplikasi lama tetap dapat berjalan selama tabel baru tidak wajib dibaca oleh kode lama. Kode fase 7 membaca tabel baru untuk rate limit, audit, dan heartbeat, jadi aplikasi lama tidak boleh diganti sebelum migrasi `0005` selesai.
