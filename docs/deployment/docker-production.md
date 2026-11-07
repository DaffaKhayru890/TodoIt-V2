# Docker production

Stage image tetap base, dependencies, development, build, dan production. Build menghasilkan `dist/main.js` dan `dist/worker.js`. User image adalah `bun`. File `.env` tidak disalin.

`compose.production.yaml` menjatuhkan seluruh capability, memakai `no-new-privileges`, root filesystem read-only, dan `/tmp` sebagai tmpfs. Container belum dijalankan dengan konfigurasi itu pada laporan ini, jadi keberhasilan proses di bawah filesystem read-only masih harus diverifikasi operator.

`bun run docker:production` hanya memvalidasi konfigurasi Compose. Ia tidak men-deploy.
