# Skema Notification Job

## Kolom

`id`, `type`, `status`, `idempotency_key` unique, identitas nullable `recipient_user_id`, `workspace_id`, `todo_id`, `reminder_id`, `notification_id`, waktu `scheduled_at` dan `available_at`, `payload` jsonb, `attempts`, `max_attempts`, lease `locked_by`, `locked_at`, `lock_expires_at`, `last_error_code`, `created_at`, `updated_at`, `completed_at`.

Foreign key ke user, workspace, todo, reminder, dan notification memakai ON DELETE SET NULL supaya riwayat job tidak hilang bila sumber dihapus. Todo sendiri memakai soft delete, jadi eligibility tetap melihat `deleted_at`.

## Constraint

- Jenis hanya `dispatch_reminder`, `dispatch_todo_due_soon`, `send_email`.
- Status hanya `pending`, `processing`, `completed`, `failed`, `cancelled`.
- `attempts >= 0` dan `max_attempts > 0`.
- Status `processing` mewajibkan ketiga kolom lease terisi. Status lain mewajibkan ketiganya null.
- Status `completed` mewajibkan `completed_at`. Status lain mewajibkan `completed_at` null.

## Index

- Partial `(available_at, id)` untuk status `pending` dan `processing`.
- Partial `lock_expires_at` untuk status `processing`.
- `(type, status, available_at)`.
- `recipient_user_id`, `todo_id`, `reminder_id`, `notification_id`.

## Retensi

Job `failed` dan `completed` tidak dihapus otomatis. Pembersihan massal belum disediakan. Perintah operasional hanya membaca atau mengembalikan job gagal ke antrean.
