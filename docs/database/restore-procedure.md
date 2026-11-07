# Restore

`infra/scripts/restore-database.sh` meminta file backup dan `RESTORE_TARGET`. Target yang namanya memuat `production` ditolak kecuali `RESTORE_I_UNDERSTAND=yes`.

Script menghapus dan membuat ulang database target. Jangan mengarahkannya ke database yang masih dipakai.

`pg_dump` dan `psql` tidak terpasang di mesin pengembangan saat fase ini ditulis, jadi restore drill belum dijalankan.
