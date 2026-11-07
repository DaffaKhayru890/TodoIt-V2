# Operasi Worker

## Menjalankan

Development:

```bash
bun run worker:dev
```

Production, environment sudah diinjeksikan proses:

```bash
bun run worker
```

Docker development memakai service `worker`. Beberapa container dapat menjalankan image yang sama dengan command `bun run dist/worker.js`.

## Menghentikan

Kirim `SIGTERM` atau `SIGINT`. Proses berhenti menerima pekerjaan, menunggu grace period, melepas lease, dan menutup pool.

## Memantau

Log terstruktur memuat `worker started`, `worker stopped`, `scheduler cycle started`, `scheduler cycle completed`, `jobs claimed`, `job completed`, `job retried`, `job failed`, dan `job cancelled`. Field yang dipakai: `jobId`, `jobType`, `attempt`, `workerId`, serta hitungan `pending`, `processing`, `failed`, `completed`.

Log tidak memuat password SMTP, token, atau payload sensitif. Tidak ada endpoint publik untuk mengunduh seluruh antrean.

## Rekonsiliasi manual

```bash
bun run notifications:reconcile
```

Perintah ini menjalankan satu siklus planner lewat composition root worker, lalu menutup database.
