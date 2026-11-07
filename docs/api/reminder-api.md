# API Reminder

Base path:

```text
/api/v1/workspaces/{workspaceId}/todos/{todoId}/reminders
```

Semua member workspace boleh membuat, melihat, mengubah, dan membatalkan reminder. Todo completed, cancelled, atau terhapus tidak dapat menerima reminder baru (`REMINDER_TODO_INELIGIBLE`).

## Create

Absolute:

```json
{ "triggerType": "absolute", "remindAt": "2026-11-09T08:00:00+07:00" }
```

`remindAt` disimpan UTC. Contoh di atas menjadi `2026-11-09T01:00:00.000Z`. `effectiveAt` sama dengan `remindAt`. `offsetMinutes` harus tidak dikirim.

Before due:

```json
{ "triggerType": "before_due", "offsetMinutes": 60 }
```

`remindAt` pada response adalah `null`. `effectiveAt` dihitung dari `todo.dueAt`. Todo tanpa `dueAt` menghasilkan **422 `REMINDER_DUE_DATE_REQUIRED`**.

Sukses: **201** `{ reminder }`. Status awal `scheduled`. ID dan `createdBy` dihasilkan server.

## List, detail, update, cancel

| Method | Path | Keterangan |
| --- | --- | --- |
| `GET` | `/reminders` | Default `status=scheduled`, `limit=20`. Nilai `status`: `scheduled`, `cancelled`, `all`. |
| `GET` | `/reminders/{reminderId}` | Detail, termasuk yang cancelled. |
| `PATCH` | `/reminders/{reminderId}` | Absolute hanya `remindAt`. Before due hanya `offsetMinutes`. |
| `DELETE` | `/reminders/{reminderId}` | Cancel, bukan hard delete. **204**, idempoten. |

Urutan list: `effectiveAt` naik, lalu `id`. Setiap item memuat `effectiveAt`.

Reminder cancelled yang di-update menghasilkan **409 `REMINDER_ALREADY_CANCELLED`**. Jadwal scheduled yang sama menghasilkan **409 `REMINDER_DUPLICATE`**. Waktu efektif di masa lalu menghasilkan **422 `REMINDER_TIME_IN_PAST`**. Offset di luar 1–43200 menghasilkan **422 `REMINDER_OFFSET_INVALID`**.

Perubahan `dueAt` Todo yang menabrak reminder before_due scheduled:

- menjadi null → **409 `TODO_HAS_RELATIVE_REMINDERS`**;
- effective time tidak di masa depan → **409 `TODO_DUE_DATE_CONFLICTS_WITH_REMINDERS`**.

Endpoint ini tidak mengirim notifikasi.
