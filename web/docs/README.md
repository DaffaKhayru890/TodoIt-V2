# TodoIt Web

Frontend TodoIt-v2. Backend tetap berada di root repository dan tidak dipindahkan. Folder `web/` adalah aplikasi React terpisah yang berbicara ke API tersebut.

Phase 1 menyiapkan tooling dan fondasi API. Phase 2 menambahkan design system Neo Brutalism, komponen UI, dan application shell dengan dua sidebar. Phase 3 mengimplementasikan Workspace Management dengan integrasi API backend, TanStack Query, dialog create/edit, konfirmasi archive, detail page, dan penanganan permission. Phase 4 mengimplementasikan Todo Management di dalam workspace: daftar tugas aktif/selesai, create/edit/delete, completion/reopen, halaman detail todo, serta seluruh state loading, empty, error, not found, dan access denied. Hard delete workspace dan fitur di luar todo dasar belum tersedia.

Dokumentasi fitur:

- [Workspace Management](workspace-feature.md)
- [Todo Management](todo-management.md)
- [Integrasi API todo](todo-api-integration.md)
- [Komponen todo](todo-components.md)
- [Testing todo](todo-testing.md)

## Teknologi

| Paket                                           | Peran                        |
| ----------------------------------------------- | ---------------------------- |
| Vite 8                                          | Dev server dan bundler       |
| React 19                                        | UI                           |
| TypeScript 6                                    | Bahasa, mode strict          |
| Tailwind CSS 4                                  | Utility CSS lewat stylesheet |
| React Router 8                                  | Routing SPA                  |
| TanStack Query 5                                | Server state                 |
| React Hook Form 7, Zod 4, @hookform/resolvers 7 | Form workspace dan validasi  |
| React Icons 5                                   | Ikon                         |
| Vitest 5, Testing Library, MSW 3                | Tes                          |
| ESLint 10 dan Prettier 3                        | Kualitas kode                |

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
│   ├── components/   komponen UI dan layout bersama
│   ├── core/         HTTP client, env, error
│   ├── features/     domain bisnis (workspace, todo)
│   ├── hooks/        hook UI bersama
│   ├── pages/        halaman placeholder
│   ├── styles/       token, global, komponen, utility
│   └── test/         setup, helper render, fixture, server MSW
└── package.json
```

## Dokumentasi

- [Fitur workspace](workspace-feature.md)
- [Fitur todo](todo-management.md)
- [Integrasi API todo](todo-api-integration.md)
- [Komponen todo](todo-components.md)
- [Testing todo](todo-testing.md)
- [Arsitektur](architecture.md)
- [Audit backend](backend-audit.md)
- [Kontrak API](api-contract.md)
- [Panduan development](development-guide.md)
- [Panduan testing](testing-guide.md)
- [Keputusan teknis](technical-decisions.md)
- [Design system](design-system.md)
- [Application layout](application-layout.md)
- [Sidebar dan navigasi](sidebar-navigation.md)
- [Routing](routing.md)
- [Responsive design](responsive-design.md)
- [Aksesibilitas](accessibility.md)
