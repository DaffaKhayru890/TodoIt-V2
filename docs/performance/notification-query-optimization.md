# Optimasi Query Notification

Scheduler tidak membaca seluruh `todos` atau `reminders`. Due-soon dibatasi horizon, status aktif, workspace yang belum diarsip, keanggotaan pembuat, dan halaman 200 baris. Reminder menghitung effective time di SQL dan hanya mengambil baris yang masuk horizon, dengan batas 2000.

Klaim memakai index parsial `(available_at, id)` pada status `pending` dan `processing`, plus `FOR UPDATE SKIP LOCKED`, sehingga worker lain tidak menunggu baris yang sedang dikunci.

Inbox memakai index `(recipient_user_id, created_at, id)`. Unread memakai `(recipient_user_id, read_at)`. Filter jenis memakai `(recipient_user_id, type, created_at)`.

Pengiriman email tidak menahan transaksi klaim.

Pada database uji, `EXPLAIN` untuk `count(*)` unread milik satu penerima memakai tabel `notifications`. Jumlah baris uji kecil, jadi planner dapat memilih sequential scan. Index tetap tersedia untuk inbox yang tumbuh. `EXPLAIN ANALYZE` mutasi tidak dijalankan pada production.
