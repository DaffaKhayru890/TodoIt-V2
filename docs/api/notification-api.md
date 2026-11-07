# API Notification

Semua endpoint membutuhkan access token Bearer. Penerima selalu pengguna yang sedang login. API publik tidak menampilkan antrean job.

## Daftar

`GET /api/v1/notifications`

Query: `limit` default 20 maksimum 100, `cursor`, `readStatus` `all|unread|read`, `type` `reminder_due|todo_due_soon`.

Urutan `created_at DESC, id DESC`.

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "todo_due_soon",
      "title": "Upcoming Deadline",
      "body": "Your task is due in 1 hour.",
      "data": { "todoId": "uuid", "workspaceId": "uuid" },
      "readAt": null,
      "createdAt": "2026-11-07T05:00:00.000Z"
    }
  ],
  "pagination": { "limit": 20, "hasMore": false, "nextCursor": null }
}
```

Notification milik pengguna lain mengembalikan 404 pada operasi baca tunggal dan tidak muncul di daftar.

## Unread count

`GET /api/v1/notifications/unread-count`

```json
{ "unreadCount": 5 }
```

## Tandai dibaca

`PATCH /api/v1/notifications/:notificationId/read` mengisi `readAt` sekali. Pemanggilan kedua tetap 200 dan mempertahankan waktu baca pertama.

`PATCH /api/v1/notifications/read-all` memperbarui semua unread milik pengguna itu dalam satu query dan mengembalikan `{ "updated": n }`.

## Preferensi

`GET /api/v1/notifications/preferences`

```json
{ "preferences": { "inAppEnabled": true, "emailEnabled": false } }
```

`PATCH` menerima `{ "emailEnabled": true }` saja. Body tidak boleh membawa `userId`. `inAppEnabled` selalu true. Perubahan berlaku untuk notification yang belum dibuat. Notification lama tidak dikirim ulang saat email diaktifkan. Job email yang masih pending dibatalkan atau dilewati bila preferensi menjadi false.

Dokumentasi interaktif: `/openapi`. JSON: `/openapi/json`. Tag OpenAPI: `Notification`.
