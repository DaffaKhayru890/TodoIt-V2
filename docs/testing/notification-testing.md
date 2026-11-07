# Pengujian Notification

Seluruh suite:

```bash
bun run typecheck
bun test --env-file=.env.test
```

Kelompok Phase 6:

```bash
bun test --env-file=.env.test tests/unit/notification tests/integration/notification-endpoints.test.ts tests/integration/notification-database.test.ts
```

Cakupan:

- Domain notification, validasi, dan mark read idempoten.
- Backoff, jitter deterministik, batas maksimum, dan kegagalan permanen.
- Scheduler due-soon serta reminder, termasuk pemanggilan kedua yang tidak menggandakan job.
- Dispatcher menolak reminder cancelled, due date lama, anggota yang keluar, dan todo selesai.
- Email sementara di-retry, preferensi mati membatalkan job, kegagalan permanen menyisakan baris failed yang dapat diantri ulang, notification tetap ada.
- Dua klaim bersamaan di memori dan di PostgreSQL.
- Lease kedaluwarsa dapat diambil worker lain.
- Worker loop berhenti setelah satu siklus.
- HTTP inbox, cursor, filter, unread, mark read, mark all, isolasi pengguna, preferensi, dan OpenAPI tanpa path job queue.
- Unique key, upsert preferensi, dan `EXPLAIN` unread pada PostgreSQL.

Email sungguhan tidak dikirim. Waktu dikendalikan `FixedClock`. Jitter uji memakai `next()` tetap.
