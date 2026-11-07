# CI

`.github/workflows/ci.yml` memakai Bun 1.4.4 yang dipin lewat action, `bun install --frozen-lockfile`, PostgreSQL 17.5 service, typecheck, boundary check, migrasi, tes, OpenAPI, dan build.

Action pihak ketiga dipin ke commit SHA. Permission workflow adalah `contents: read`. Workflow ini belum dijalankan karena tidak ada bukti run di platform. Keberhasilan lokal tidak sama dengan keberhasilan CI.
