# Antrean Job PostgreSQL

Antrean disimpan di tabel `notification_jobs`. Tidak ada Redis dan tidak ada array memori sebagai sumber kebenaran. Application hanya melihat interface `NotificationJobQueue`.

## Klaim

Dalam satu transaksi singkat:

```sql
UPDATE notification_jobs
SET status = 'processing', locked_by = $worker, locked_at = $now,
    lock_expires_at = $lease, attempts = attempts + 1, updated_at = $now
WHERE id IN (
  SELECT id FROM notification_jobs
  WHERE (status = 'pending' AND available_at <= $now)
     OR (status = 'processing' AND lock_expires_at <= $now)
  ORDER BY available_at, id
  LIMIT $n
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

Transaksi selesai sebelum email dikirim.

## Lease

Default 60 detik. Hanya pemilik lease yang masih berlaku yang boleh `complete`, `retry`, `fail`, atau `cancel` job yang sedang diproses. Heartbeat memperpanjang lease. Lease kedaluwarsa membuat job dapat diklaim worker lain, dan `attempts` bertambah lagi.

## Retry

Kegagalan sementara mengembalikan status `pending`, mengosongkan lease, dan mengisi `available_at` dengan backoff `base * 2^(attempts-1)` plus jitter ±20%, dibatasi `maxRetrySeconds`. Attempt pertama setelah claim memakai basis 5 detik bila jitter netral.

Error permanen atau attempt yang sudah mencapai `maxAttempts` menjadi `failed`. Baris tidak dihapus.

## Idempotensi

Unique `idempotency_key` menolak job ganda saat scheduler berjalan berulang. Unique yang sama pada `notifications` menolak pesan inbox ganda. Key email adalah `notification-email:{notificationId}`.

## Pemulihan

Crash meninggalkan status `processing` sampai lease habis, lalu worker mana pun dapat mengambilnya. Shutdown yang rapi melepaskan lease tanpa menandai job selesai. Operator dapat mengembalikan job `failed` ke `pending` tanpa mengubah key.
