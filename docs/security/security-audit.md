# Hasil audit keamanan

`bun audit` pada 7 Nov 2026 melaporkan 1 temuan moderate: `esbuild` lewat `drizzle-kit` (GHSA-67mh-4wv8-2f99). Paket itu dependency pengembangan. Image production memakai `bun install --production` sehingga drizzle-kit tidak ikut. Risiko diterima untuk runtime production. Temuan critical tidak muncul pada audit ini.

| ID | Severity | Status |
| --- | --- | --- |
| F-01 | Medium | Diperbaiki: production menolak kredensial development dan role database superuser |
| F-02 | Medium | Diperbaiki: Origin diperiksa pada refresh dan logout |
| F-03 | Medium | Diperbaiki: rate limit bersama di PostgreSQL, bukan counter memori sebagai sumber production |
| F-04 | Low | Diperbaiki: redaksi log untuk authorization dan password |
| F-05 | Low | Diterima: email tetap at-least-once |
| F-06 | Informational | HSTS tidak dipaksa karena TLS dapat berakhir di reverse proxy. Aktifkan `SECURITY_HSTS` hanya pada koneksi HTTPS |
| F-07 | Informational | `X-Forwarded-For` diabaikan sampai `TRUSTED_PROXY_HOPS` lebih dari nol |
| F-08 | Medium | Belum dipindai: tidak ada Trivy atau Syft di mesin ini, jadi kerentanan OS image belum diverifikasi |

Tidak ada klaim bahwa aplikasi bebas kerentanan.
