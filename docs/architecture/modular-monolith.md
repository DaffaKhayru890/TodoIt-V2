# Modular Monolith

Proyek ini satu aplikasi yang di-deploy sebagai satu proses. "Modular" berarti di dalam satu
codebase itu, setiap business module berdiri sendiri dengan lapisan lengkapnya dan tidak boleh
mengintip isi module lain.

## Bentuk folder module

```text
src/modules/<nama-module>/
├── domain/           # entity, value object, domain error, business rule (buat saat ada isinya)
├── application/      # use case, DTO, port/interface
│   └── ports/
├── infrastructure/   # adapter: implementasi port, mapper, query Drizzle module ini
└── presentation/
    └── http/         # route Elysia, schema, metadata OpenAPI
```

Module yang sudah ada: `health`. Module berikutnya (phase 2+) direncanakan: `auth`/`user`,
`workspace`, `todo`, `tag`, `reminder`, `notification`.

## Batasan module

1. **Tidak ada impor lintas layer dalam.** Module lain hanya boleh menyentuh `application/`
   (use case) atau `domain/` module target.
2. **Tidak ada impor ke dalam `infrastructure/` module lain.** Kalau `todo` butuh data user,
   ia memakai port yang di-owner `todo` dan diimplementasikan oleh adapter yang menyatukan
   keduanya di composition root, bukan `import { usersTable } from '../user/...'`.
3. **Public contract eksplisit.** Yang dianggap "publik" dari sebuah module adalah use case dan
   tipe DTO-nya. Folder `presentation/http` dan `infrastructure` adalah urusan internal module.
4. **Skema database bersama hanya lewat contract.** Tabel dimodelkan di `infrastructure` module
   pemiliknya. Module lain tidak menulis query ke tabel itu langsung.
5. **Route dipublikasikan lewat satu tempat.** Penambahan route module baru hanya dengan
   menambah `.use(createXRoutes(deps))` di `src/bootstrap/register-modules.ts`.

## Komunikasi antar module

| Kebutuhan | Mekanisme |
|-----------|-----------|
| Module A butuh kemampuan module B | A memanggil use case B (lewat interface) yang disuntikkan di composition root. |
| A dan B perlu berbagi aturan murni | Pindahkan ke `src/shared/domain` bila benar-benar milik bersama; kalau hanya mirip, biarkan terpisah. |
| A memberi tahu B bahwa sesuatu terjadi (loosely coupled) | Domain event di `src/shared/application` (belum dipakai pada Phase 1; tambahkan saat kebutuhan nyata muncul). |
| A dan B menyentuh tabel yang sama | Putuskan pemilik tabelnya. Module lain akses lewat use case pemilik, bukan lewat tabel. |

## Pencegahan circular dependency

- Arah impor hanya boleh keluar→dalam (`presentation → application → domain`). Karena domain tidak
  mengimpor apa pun, siklus tidak punya tempat untuk terbentuk.
- Module tidak saling mengimpor `presentation`. Route adalah daun dari graf dependency.
- Dependency antar module disatukan di `src/bootstrap/container.ts`, bukan saling import langsung.
  Composition root boleh tahu semuanya; module tidak.
- Konsekuensi praktisnya: kalau muncul `import` dari module A ke `infrastructure` module B, itu
  sinyal keras ada siklus atau pelanggaran batas — refactor dengan menambah port.
- Konvensi penamaan folder dan prefix API (`/api/v1/...`) membuat ownership route jelas sehingga
  dua module tidak berebut tempat yang sama.

## Perbedaan dengan microservices

| Aspek | Modular monolith (proyek ini) | Microservices |
|-------|-------------------------------|---------------|
| Deployment | Satu artefak, satu proses | Banyak service, banyak pipeline |
| Komunikasi antar bagian | Panggilan fungsi/interface in-process | HTTP/gRPC/event bus + retry + timeout |
| Transaksi | Transaksi database biasa | Saga / outbox / eventual consistency |
| Batas module | Ditegakkan oleh konvensi + aturan impor | Ditegakkan oleh batas proses/jaringan |
| Biaya operasional | Rendah | Tinggi (observability, service discovery) |
| Skala | Skala horizontal satu proses | Skala per-service |

Karena batas module sudah dibuat eksplisit, bila suatu saat satu module perlu dipecah menjadi
service, pekerjaan utamanya adalah memindahkan `presentation` + `application` module itu ke
process baru — business rule dan use case tidak perlu ditulis ulang.
