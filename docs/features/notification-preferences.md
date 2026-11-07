# Preferensi Notifikasi

Tidak ada baris preferensi berarti `emailEnabled = false`. In-app tetap dibuat.

Saat dispatch, email job `notification-email:{notificationId}` hanya di-enqueue bila preferensi saat itu aktif. Saat worker mengirim, preferensi dibaca lagi. Bila sudah mati, job email dibatalkan dan inbox tetap ada.

Mengaktifkan email tidak mengirim ulang notification yang sudah dibuat.
