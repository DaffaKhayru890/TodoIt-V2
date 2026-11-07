# Uji beban

Skrip k6:

- `tests/load/auth.load.js`
- `tests/load/workspace.load.js`
- `tests/load/todo.load.js`
- `tests/load/pagination.load.js`
- `tests/load/notification.load.js`

Jalankan terhadap development atau staging, bukan production. Contoh: `k6 run -e BASE_URL=http://127.0.0.1:4000 tests/load/auth.load.js`.

Hasil pada laporan fase ini tidak memuat RPS jaringan karena skrip belum dieksekusi.
