# Troubleshooting worker

Worker yang berhenti mengirim heartbeat tetapi prosesnya hilang akan terlihat dari `last_seen_at` yang tua. Job yang ditinggalkan dapat diklaim setelah lease habis.

Shutdown mengirim `SIGTERM`, menunggu grace, lalu melepas lease tanpa menandai job selesai.
