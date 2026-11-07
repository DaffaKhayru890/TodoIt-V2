# Arsitektur Background Worker

Worker adalah proses terpisah dari API. Proses API tidak memanggil scheduler di dalam request Elysia, dan `NOTIFICATION_WORKER_ENABLED` hanya dibaca oleh `src/worker.ts`.

## Entry point

`src/worker.ts` memuat konfigurasi, keluar dengan kode 1 bila environment tidak valid, dan keluar dengan kode 0 bila worker dimatikan. Bila aktif, ia membuat composition root `createWorker()` lalu menjalankan `NotificationWorkerRuntime`.

`createWorker()` memakai database, queue PostgreSQL, reconciliation, dispatcher, runner, dan SMTP transport yang sama dengan undangan. Worker id berbentuk `worker-{hostname}-{pid}`. Perintah operasional memakai id `operator` dan tidak masuk ke loop.

## Alur satu siklus

```mermaid
sequenceDiagram
  participant Loop as Worker loop
  participant Planner as Reconciliation
  participant DB as PostgreSQL
  participant Runner as Job runner
  participant SMTP as SMTP

  Loop->>Planner: jika interval scheduler tercapai
  Planner->>DB: baca jadwal eligible lalu enqueue
  Planner->>DB: batalkan job pending yang sumbernya tidak eligible
  Loop->>DB: claim batch FOR UPDATE SKIP LOCKED
  DB-->>Loop: job processing dengan lease
  Loop->>Runner: proses di luar transaksi claim
  alt dispatch
    Runner->>DB: insert notification, email job bila perlu, complete
  else email
    Runner->>SMTP: kirim setelah transaksi selesai
    Runner->>DB: complete, retry, atau fail
  end
```

## Beberapa instance

Koordinasi memakai row lock PostgreSQL dan kepemilikan lease. Tidak ada lock global di memori. Dua worker yang mengklaim bersamaan hanya salah satu yang mendapat baris yang sama.

Job yang berjalan lama memperbarui `lock_expires_at` kira-kira setiap sepertiga durasi lease, dan hanya jika worker itu masih pemiliknya.

## Shutdown

`SIGINT` dan `SIGTERM` memanggil `requestStop()`:

1. Loop berhenti mengambil pekerjaan baru dan berhenti menjadwalkan siklus baru.
2. Job yang sudah diklaim diberi waktu grace, paling lama 15 detik atau durasi lease.
3. Job yang belum selesai tidak ditandai completed.
4. Lease milik worker ini diubah agar `lock_expires_at` menjadi waktu sekarang, sehingga worker lain dapat mengklaimnya.
5. Pool database ditutup.

Bila proses mati sebelum langkah itu, lease yang kedaluwarsa tetap dapat diklaim ulang.
