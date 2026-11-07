# Gambaran Besar Arsitektur

Backend ini adalah **satu codebase modular monolith** dengan **Clean Architecture** di dalam
setiap business module. Satu proses, satu deployment unit, tetapi batas antar module dijaga
sehingga framework, ORM, dan driver dapat diganti tanpa menyentuh business logic.

## Struktur layer

```mermaid
flowchart TD
    subgraph Presentation["Presentation (HTTP)"]
        ROUTES["Elysia routes<br/>modules/*/presentation/http"]
        ERRORS["Error envelope + request id<br/>shared/presentation/http"]
        OPENAPI["OpenAPI/Scalar + CORS<br/>shared/presentation/http/plugins"]
    end

    subgraph Application["Application"]
        USECASE["Use cases & DTO<br/>modules/*/application"]
        PORTS["Port / contract<br/>modules/*/application/ports"]
    end

    subgraph Domain["Domain"]
        RULES["Entities, value objects, domain errors<br/>(belum ada pada Phase 1)"]
    end

    subgraph Infrastructure["Infrastructure"]
        DBCLIENT["DatabaseClient (pg pool + Drizzle)<br/>shared/infrastructure/database"]
        PROBES["Adapter implementasi port<br/>modules/*/infrastructure"]
        LOGGING["Structured logger<br/>shared/infrastructure/logging"]
    end

    DB[("PostgreSQL")]

    ROUTES --> USECASE
    ROUTES --> ERRORS
    USECASE --> RULES
    USECASE -.-"mengonsumsi contract"--> PORTS
    PORTS -.->|diimplementasi oleh| PROBES
    PROBES --> DBCLIENT
    DBCLIENT --> DB
    Infrastructure -->|dihubungkan di| COMPOSE["Composition Root<br/>src/bootstrap/container.ts"]
    COMPOSE --> ROUTES
```

Arah dependency hanya satu: **Presentation → Application → Domain**. Infrastructure berada di
luar lingkaran dalam dan bergantung pada contract yang didefinisikan layer dalam, bukan
sebaliknya.

## Layer dan realisasinya di Phase 1

| Layer | Isi | Lokasi pada Phase 1 |
|-------|-----|---------------------|
| Domain | Entity, value object, domain error, business rule, repository contract. | Belum ada. Modul health tidak punya business rule sehingga tidak dipaksasi membuat domain kosong. |
| Application | Use case, application service, DTO input/output, port. | `src/modules/health/application/check-service-readiness.ts`, `src/modules/health/application/ports/database-probe.ts`. |
| Infrastructure | Koneksi database, driver, ORM, mapper, adapter. | `src/shared/infrastructure/database/client.ts`, `src/shared/infrastructure/database/schema/index.ts`, `src/shared/infrastructure/logging/logger.ts`, `src/modules/health/infrastructure/database-probe.ts`. |
| Presentation | Route Elysia, schema request/response, metadata dokumentasi, error HTTP. | `src/modules/health/presentation/http/health.routes.ts`, `src/shared/presentation/http/**`. |
| Config | Validasi environment dan bentuk konfigurasi yang dipakai bersama. | `src/config/env-schema.ts`, `src/config/env.ts`, `src/config/app-config.ts`. |
| Bootstrap | Composition root dan perakit aplikasi. | `src/main.ts`, `src/bootstrap/container.ts`, `src/bootstrap/create-app.ts`, `src/bootstrap/register-modules.ts`. |

## Composition Root

Hanya `src/bootstrap/container.ts` yang tahu implementasi konkret mana yang dipakai:

```mermaid
flowchart LR
    ENV["process.env<br/>(.env.test / .env.development / dst)"] --> CFG["loadAppConfig()<br/>src/config/app-config.ts"]
    CFG --> CTN["createApplicationContainer()<br/>src/bootstrap/container.ts"]
    CTN --> LOG["createLogger(logLevel)"]
    CTN --> DBC["createDatabaseClient(dbConfig, logger)"]
    DBC --> PRB["createDatabaseProbe(client)"]
    PRB --> UC["new CheckServiceReadiness(probe)"]
    CTN --> APP["createApp({ config, logger, readiness })"]
    UC --> APP
    APP --> SRV["app.listen(port, host)"]
```

Hasilnya:

- Application hanya mengenal interface `DatabaseProbe`, tidak mengenal `pg` atau Drizzle.
- Test dapat mengganti `DatabaseProbe` dengan stub tanpa menyentuh route (lihat
  `tests/helpers/test-app.ts`).
- Tidak ada singleton global dan tidak ada `process.env` yang dibaca di luar `src/config/env.ts`.

## Alur request sampai database

Contoh untuk `GET /ready`:

```mermaid
sequenceDiagram
    participant C as Klien
    participant M as Middleware (shared/presentation/http)
    participant R as HealthRoutes (presentation)
    participant U as CheckServiceReadiness (application)
    participant P as DatabaseProbe port
    participant A as createDatabaseProbe (infrastructure)
    participant D as DatabaseClient (pg pool)
    participant PG as PostgreSQL

    C->>M: GET /ready
    M->>M: ensureRequestId() → x-request-id
    M->>R: handle (requestId tersedia di set.headers)
    R->>U: execute()
    U->>P: probe() dengan batas waktu
    P->>A: implementasi adapter
    A->>D: ping()
    D->>PG: SELECT 1
    PG-->>D: hasil
    D-->>A: resolve
    A-->>U: resolve
    U-->>R: { status: "ready", database: "connected" }
    R-->>C: 200 { "status": "ready", "dependencies": { "database": "connected" } }
    M->>M: access log terstruktur (requestId, method, path, status)
```

Bila `SELECT 1` gagal atau melebihi batas waktu, use case mengembalikan
`{ status: "unavailable" }` dan presentation memetakan ke **HTTP 503** dengan sampul error
standar `{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "...", "requestId": "..." } }`.
Detail koneksi tidak pernah ikut terkirim.

## Alur error

```mermaid
flowchart TD
    E["Error apa pun di handler / lifecycle Elysia"] --> MAP["mapErrorToHttpResponse()<br/>shared/presentation/http/errors"]
    MAP -->|"ValidationError (TypeBox)"| V["422 VALIDATION_ERROR + details per field"]
    MAP -->|"ParseError"| P["400 BAD_REQUEST"]
    MAP -->|"NotFoundError"| N["404 NOT_FOUND"]
    MAP -->|"lainnya"| I["500 INTERNAL_SERVER_ERROR (pesan generik)"]
    V --> LOG["Server log: requestId + error name saja"]
    P --> LOG
    N --> LOG
    I --> LOG
    LOG --> RESP["Klien hanya menerima sampul error aman"]
```

## Kenapa Modular Monolith, bukan microservices

1. **Ukuran domain belum menuntut pemisahan proses.** Satu tim, satu deployment, satu database
   development — biaya operasional microservices (networking, observability terdistribusi,
   deployment terpisah) tidak sebanding pada fase ini.
2. **Batas module tetap dipaksa.** Karena tiap module punya layer sendiri dan hanya berkomunikasi
   lewat contract, pemecahan menjadi service di kemudian hari menjadi perubahan deployment,
   bukan perubahan business logic.
3. **Transaksi lebih sederhana.** Operation Todo dapat memakai satu transaksi PostgreSQL tanpa
   perlu saga atau eventual consistency antar service.
4. **Testing lebih cepat.** `createApp()` dirakit di memori dan diuji lewat `app.handle(Request)`
   tanpa membuka port, sesuatu yang jauh lebih mahal pada arsitektur terdistribusi.

Lihat [modular-monolith.md](modular-monolith.md) untuk batas module dan aturan komunikasinya.
