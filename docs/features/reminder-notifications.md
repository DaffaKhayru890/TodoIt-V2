# Notifikasi Reminder

Reminder Phase 4 tetap sumber jadwal. Notification engine tidak menulis status pengiriman ke reminder.

Absolute memakai `remindAt`. Before due memakai `dueAt - offsetMinutes`. Keduanya melewati clock aplikasi, bukan `new Date()` di aturan bisnis.

Penerima adalah `reminders.created_by`. Reminder harus `scheduled`, todo belum selesai, dibatalkan, atau dihapus, workspace aktif, anggota masih ada, dan effective time sudah tercapai.

Judul: `Todo Reminder`. Isi: `Your task "{judul}" is scheduled for a reminder.`

Bila reminder dibatalkan atau due date yang mendasari before-due berubah, job dengan effective time lama tidak membuat notification.
