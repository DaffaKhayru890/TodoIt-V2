# Idempotensi

Scheduler boleh berjalan berkali-kali. Key job tidak memakai waktu scheduler.

| Sumber | Key |
| --- | --- |
| Reminder | `reminder:{id}:{effectiveAt ISO}` |
| Due soon | `todo-due-soon:{todoId}:{dueAt ISO}:{offset}` |
| Email | `notification-email:{notificationId}` |
| Baris inbox | `notification:` ditambah key job sumber |

Insert notification memakai `ON CONFLICT DO NOTHING` lalu membaca baris yang sudah ada. Enqueue job mengabaikan key yang sudah ada.

Satu transaksi database mencakup insert notification, enqueue email bila perlu, dan complete job dispatch. Bila transaksi gagal, ketiganya rollback. Pengiriman SMTP berada di luar transaksi itu.
