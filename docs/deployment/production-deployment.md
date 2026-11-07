# Production

Deployment production berstatus menunggu eksekusi manual. Workflow `release.yml` hanya mencatat approval dan tidak mendorong image serta tidak mengubah DNS.

Perintah di dalam image: API `bun dist/main.js`, worker `bun dist/worker.js`. `bun run start` di checkout source tetap menjalankan `src/main.ts` karena source tidak ada di image.

Jangan memakai kredensial development. PostgreSQL tidak boleh terbuka ke internet.
