# Daftar periksa rilis

- Typecheck lulus.
- Tes regresi lulus.
- `bun audit` ditinjau.
- Migrasi dicoba pada database kosong atau staging.
- Backup terbaru diverifikasi.
- Secret production tidak ada di repo atau image.
- `/health` dan `/ready` diperiksa setelah deploy.
- Worker heartbeat muncul.
- Rollback image diketahui.
- Approval manusia tercatat.

Item yang belum dilakukan tidak boleh dicentang.
