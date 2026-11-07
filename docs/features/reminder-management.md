# Pengelolaan Reminder

Reminder menjadwalkan pengingat pada satu Todo. Fase ini tidak mengirim pesan.

## Buat

Absolute memakai waktu tertentu di masa depan:

```http
POST /api/v1/workspaces/{workspaceId}/todos/{todoId}/reminders
{ "triggerType": "absolute", "remindAt": "2026-11-09T08:00:00+07:00" }
```

Before due memakai menit sebelum `dueAt`:

```http
POST /api/v1/workspaces/{workspaceId}/todos/{todoId}/reminders
{ "triggerType": "before_due", "offsetMinutes": 60 }
```

Jika `dueAt` Todo adalah `2026-11-10T09:00:00+07:00`, effective time adalah `2026-11-10T08:00:00+07:00`. Response menuliskannya sebagai instant UTC pada `effectiveAt`.

## Ubah dan batalkan

```http
PATCH /reminders/{reminderId}
{ "remindAt": "2026-11-09T10:00:00+07:00" }
```

```http
PATCH /reminders/{reminderId}
{ "offsetMinutes": 30 }
```

Trigger type tidak dapat diganti. Client tidak dapat mengirim `id`, `todoId`, `createdBy`, `status`, `createdAt`, atau `cancelledAt`.

```http
DELETE /reminders/{reminderId}
```

mengembalikan 204. Pemanggilan kedua tetap 204 dan tidak menggeser `cancelledAt`. Riwayat tetap terlihat dengan `?status=cancelled` atau `?status=all`.

## Daftar

Default hanya `scheduled`, diurutkan `effectiveAt` menaik, `id` sebagai tie-breaker. `limit` default 20, maksimum 100, cursor opaque terikat pada Todo dan filter status.
