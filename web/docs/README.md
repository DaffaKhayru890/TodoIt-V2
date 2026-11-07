# TodoIt Web

Frontend TodoIt-v2. Backend tetap berada di root repository dan tidak dipindahkan. Folder `web/` adalah aplikasi React terpisah yang berbicara ke API tersebut.

Phase ini hanya menyiapkan fondasi: tooling, routing, query client, HTTP client, environment, tes, dan dokumentasi. Halaman workspace, todo, login, dan notifikasi belum dibuat.

## Teknologi

| Paket                                           | Peran                                 |
| ----------------------------------------------- | ------------------------------------- |
| Vite 8                                          | Dev server dan bundler                |
| React 19                                        | UI                                    |
| TypeScript 6                                    | Bahasa, mode strict                   |
| Tailwind CSS 4                                  | Utility CSS lewat stylesheet          |
| React Router 8                                  | Routing SPA                           |
| TanStack Query 5                                | Server state                          |
| React Hook Form 7, Zod 4, @hookform/resolvers 7 | Terpasang untuk form phase berikutnya |
| React Icons 5                                   | Ikon                                  |
| Vitest 5, Testing Library, MSW 3                | Tes                                   |
| ESLint 10 dan Prettier 3                        | Kualitas kode                         |

Versi tepat ada di `package.json`. Package manager frontend adalah Bun, dengan lockfile sendiri di `web/bun.lock`.

## Prasyarat

- Bun 1.4 atau lebih baru.
- Backend API berjalan terpisah, default di `http://localhost:4000`.

## Instalasi

```bash
cd web
bun install
cp .env.example .env
```

## Environment

`VITE_API_BASE_URL` adalah URL publik API. Contoh development: `http://localhost:4000`. Jangan menaruh secret, password database, atau JWT secret pada variabel `VITE_`.

## Perintah

| Perintah                | Fungsi                          |
| ----------------------- | ------------------------------- |
| `bun run dev`           | Dev server di port 5173         |
| `bun run typecheck`     | `tsc -b --pretty`               |
| `bun run lint`          | ESLint pada folder `web/`       |
| `bun run format`        | Prettier menulis file frontend  |
| `bun run format:check`  | Prettier tanpa mengubah file    |
| `bun run test:run`      | Vitest sekali jalan             |
| `bun run test:coverage` | Vitest dengan coverage v8       |
| `bun run build`         | Typecheck lalu production build |
| `bun run preview`       | Menayangkan hasil build         |

Semua perintah dijalankan dari `web/` sehingga tidak memformat atau me-lint backend.

## Struktur

```text
web/
├── docs/
├── src/
│   ├── app/          inisialisasi, provider, router
│   ├── components/   komponen UI bersama
│   ├── core/         HTTP client, env, error
│   ├── pages/        halaman placeholder
│   ├── styles/       token, global, komponen, utility
│   └── test/         setup, helper render, server MSW
└── package.json
```

Folder `features/` belum dibuat karena belum ada domain UI.

## Dokumentasi

- [Arsitektur](architecture.md)
- [Audit backend](backend-audit.md)
- [Kontrak API](api-contract.md)
- [Panduan development](development-guide.md)
- [Panduan testing](testing-guide.md)
- [Keputusan teknis](technical-decisions.md)
