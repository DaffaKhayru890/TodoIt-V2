# Strategi tes final

Regresi fase 1 sampai 6 tetap di `bun test --env-file=.env.test`. Tambahan fase 7 ada di `tests/security` dan `tests/unit/architecture-boundaries.test.ts`.

`bun run verify` menjalankan typecheck, boundary, OpenAPI, seluruh tes, dan build. Perintah itu membutuhkan database tes.
