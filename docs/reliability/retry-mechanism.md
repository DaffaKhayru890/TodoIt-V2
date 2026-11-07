# Mekanisme Retry

Konfigurasi: `NOTIFICATION_JOB_MAX_ATTEMPTS=8`, `NOTIFICATION_JOB_BASE_RETRY_SECONDS=5`, `NOTIFICATION_JOB_MAX_RETRY_SECONDS=3600`. Nilai maksimum harus lebih besar atau sama dengan basis.

`attempts` naik saat klaim. Kegagalan pertama memakai `base * 2^0`, kedua `base * 2^1`, dan seterusnya, dikali faktor 0.8 sampai 1.2 dari sumber jitter, lalu dibulatkan, minimal 1 detik dan maksimal batas atas.

Sementara: SMTP sementara, timeout, koneksi database sesaat. Permanen: penerima tidak valid, notification hilang, jenis job tidak dikenal, penolakan SMTP permanen.

Job `failed` tetap tersimpan. `bun run notifications:retry-failed -- <jobId>` hanya mengubah status `failed` menjadi `pending`, mengosongkan lease, menolkan attempts, dan mempertahankan idempotency key. Job `completed` dan `cancelled` ditolak.
