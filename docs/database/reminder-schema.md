# Skema Reminder

Migration: `drizzle/0002_complex_logan.sql`.

## 1. Kolom

| Kolom | Tipe | Null | Keterangan |
| --- | --- | --- | --- |
| `id` | `uuid` | tidak | Primary key. |
| `todo_id` | `uuid` | tidak | FK `todos(id)` `ON DELETE CASCADE`. |
| `created_by` | `uuid` | tidak | FK `users(id)`. |
| `trigger_type` | `varchar(20)` | tidak | `absolute` atau `before_due`. |
| `remind_at` | `timestamptz` | ya | Hanya absolute. |
| `offset_minutes` | `integer` | ya | Hanya before_due, 1–43200. |
| `status` | `varchar(20)` | tidak | `scheduled` atau `cancelled`. |
| `created_at` / `updated_at` | `timestamptz` | tidak | `updated_at >= created_at`. |
| `cancelled_at` | `timestamptz` | ya | Wajib bila cancelled. |

Tidak ada kolom `effective_at`.

## 2. Check constraint

Absolute:

- `remind_at IS NOT NULL`
- `offset_minutes IS NULL`

Before due:

- `remind_at IS NULL`
- `offset_minutes BETWEEN 1 AND 43200`

Status cancelled mewajibkan `cancelled_at`. Status scheduled mewajibkan `cancelled_at IS NULL`.

## 3. Index

| Index | Kegunaan |
| --- | --- |
| `reminders_todo_id_idx` | Semua reminder satu Todo. |
| `reminders_todo_id_status_idx` | Listing default `status = scheduled`. |
| `reminders_trigger_type_idx` | Filter tipe. |
| `reminders_scheduled_absolute_remind_at_idx` | Partial index `remind_at` untuk absolute scheduled. |
| `reminders_absolute_schedule_uidx` | Unik `(todo_id, remind_at)` bila absolute dan scheduled. |
| `reminders_before_due_schedule_uidx` | Unik `(todo_id, offset_minutes)` bila before_due dan scheduled. |

Index unik bersifat partial. Dua reminder cancelled boleh memiliki waktu yang sama. Dua request bersamaan untuk jadwal scheduled yang sama hanya satu yang berhasil; repository memetakan konflik ke `REMINDER_DUPLICATE`.

## 4. Effective time pada query

Listing mengurutkan ekspresi:

```sql
COALESCE(
  remind_at,
  due_at - (offset_minutes * interval '1 minute')
) ASC NULLS LAST, id ASC
```

`due_at` dibaca dari Todo yang sudah diotorisasi, bukan disimpan ulang di tabel reminder.
