# Connection pool

`DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_CONNECTION_TIMEOUT_MS`, dan `DATABASE_STATEMENT_TIMEOUT_MS` dibaca dari environment. Default sama dengan nilai yang sebelumnya tertulis di kode: pool 10, idle 30 detik, koneksi 5 detik. Statement timeout default 15 detik adalah batas baru agar query tidak menggantung tanpa batas.
