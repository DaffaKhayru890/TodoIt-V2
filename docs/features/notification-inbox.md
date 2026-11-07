# Inbox Notifikasi

Setiap baris dimiliki satu `recipient_user_id`. Daftar, unread count, dan perubahan status baca hanya menyentuh baris itu.

Cursor opaque versi base64url memuat `createdAt`, `id`, dan sidik filter. Filter `readStatus` atau `type` yang berbeda menolak cursor lama.

Unread count adalah `COUNT` yang dibatasi penerima dan `read_at IS NULL`. Mark-all adalah satu `UPDATE`, bukan memuat seluruh inbox ke memori.

Menandai satu notification dua kali tidak menggeser `readAt`.
