# Batas arsitektur

Pemeriksaan otomatis ada di `scripts/check-boundaries.ts` dan `tests/unit/architecture-boundaries.test.ts`.

Aturan yang diperiksa: file di `domain` dan `application` tidak mengimpor `drizzle-orm`, `elysia`, `nodemailer`, atau `pg`, dan tidak membaca `process.env`.

Dispatcher notifikasi boleh memakai rumus reminder dari domain Todo. Itu ketergantungan domain ke domain, bukan ke infrastructure.
