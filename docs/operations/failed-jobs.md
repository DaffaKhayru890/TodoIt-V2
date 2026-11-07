# Job Gagal

Job `failed` tetap di `notification_jobs` bersama `last_error_code` yang sudah disanitasi.

Inspeksi tidak mencetak payload:

```bash
bun run notifications:inspect-job -- <jobId>
```

Keluaran memuat id, type, status, attempts, scheduledAt, availableAt, lastErrorCode, createdAt, dan completedAt.

Setelah penyebab diperiksa:

```bash
bun run notifications:retry-failed -- <jobId>
```

Hanya status `failed` yang diubah menjadi `pending` dengan attempts 0 dan lease kosong. Idempotency key tidak diganti. Status `completed` dan `cancelled` menghasilkan pesan kesalahan dan kode keluar 1.
