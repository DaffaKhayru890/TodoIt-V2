# Jaminan Pengiriman

Inbox memakai insert idempoten. Satu key hanya menghasilkan satu baris.

Eksekusi job bersifat at-least-once. Lease yang kedaluwarsa atau proses yang mati setelah sebagian kerja dapat membuat job yang sama diproses lagi. Unique key mencegah notification inbox kedua.

Email bersifat at-least-once. SMTP dapat menerima pesan lalu acknowledgment hilang sebelum worker menandai job selesai. Sistem tidak menjanjikan exactly-once untuk email. Message-ID stabil membantu mengenali pengiriman berulang.

Kegagalan email tidak menghapus inbox.
