# Skema Notification

Migration `drizzle/0004_notification_engine.sql`. Tabel sebelumnya tidak diubah.

## notifications

| Kolom | Arti |
| --- | --- |
| id | UUID primary key |
| recipient_user_id | Penerima, FK users ON DELETE CASCADE |
| workspace_id | Workspace, FK workspaces ON DELETE CASCADE |
| todo_id | Todo terkait, FK ON DELETE SET NULL |
| reminder_id | Reminder terkait, FK ON DELETE SET NULL |
| type | `reminder_due` atau `todo_due_soon` |
| title, body | Teks yang ditampilkan |
| data | JSON non-sensitif |
| idempotency_key | Unique |
| read_at | Null berarti belum dibaca |
| created_at | Waktu server |

Index:

- `(recipient_user_id, created_at DESC, id DESC)` untuk daftar inbox.
- `(recipient_user_id, read_at)` untuk unread count.
- `(recipient_user_id, type, created_at DESC)` untuk filter jenis.
- `workspace_id` dan `todo_id`.

Notification baru selalu `read_at` null. Menandai dibaca memakai waktu server dan tidak menimpa `read_at` yang sudah ada.

## notification_preferences

`user_id` primary key ke users ON DELETE CASCADE, `email_enabled` default false, `updated_at`. Upsert berdasarkan `user_id`. Tidak ada kolom untuk mematikan in-app.
