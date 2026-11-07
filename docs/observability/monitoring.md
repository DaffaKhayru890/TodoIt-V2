# Monitoring

Sinyal yang tersedia: log JSON, counter dalam proses, heartbeat worker, dan jumlah job lewat perintah operasional.

Rekomendasi alert, belum dipasang di sistem eksternal:

- `/ready` gagal.
- Heartbeat worker lebih lama dari dua interval scheduler.
- Jumlah job `failed` naik terus.
- Jumlah `pending` tumbuh sementara worker tetap heartbeat.
