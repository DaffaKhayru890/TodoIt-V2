# Panduan development

Perintah dijalankan di dalam folder `web/`.

## Instal dependency

```bash
cd web
bun install
```

Lockfile frontend adalah `web/bun.lock`. Jangan menjalankan `bun add` dari root repository. Itu akan mengubah `package.json` backend.

## Environment

```bash
cp .env.example .env
```

Isi `VITE_API_BASE_URL=http://localhost:4000` bila backend memakai port default. Variabel ini dibaca hanya lewat `src/core/config/env.ts`.

## Development server

```bash
bun run dev
```

Server memakai port 5173 dan `strictPort`. Port ini sudah tercakup contoh CORS backend. Buka `http://localhost:5173`. Halaman `/` menampilkan placeholder. Path lain menampilkan halaman tidak ditemukan.

## Pemeriksaan

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test:run
bun run test:coverage
bun run build
```

`build` menjalankan `tsc -b` lalu `vite build`. Hasil ada di `web/dist`.

Formatter dan linter hanya melihat file di `web/` karena konfigurasi dan perintahnya hidup di folder itu.
