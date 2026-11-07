# Optimasi database

Constraint dan index fase 1 sampai 6 tetap menjadi lapisan integritas. Migration `0005_production_hardening` menambah `audit_events`, `rate_limit_windows`, dan `worker_heartbeats`.

Budget koneksi yang perlu dihitung operator:

`replika API × DATABASE_POOL_MAX + replika worker × DATABASE_POOL_MAX + koneksi migrasi`.

Default pool 10. Jangan menaikkan pool tanpa mengetahui `max_connections` PostgreSQL.
