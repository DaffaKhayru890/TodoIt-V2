# Arsitektur final

Aplikasi tetap Clean Architecture dan modular monolith. API serta worker berbagi domain, application, dan infrastructure. Tidak ada panggilan HTTP internal antar proses.

```mermaid
flowchart TB
  Internet --> Proxy[Reverse proxy]
  Proxy --> API[src/main.ts]
  API --> Modules[Auth Workspace Todo Notification]
  Worker[src/worker.ts] --> Modules
  Modules --> DB[(PostgreSQL)]
  Worker --> SMTP[SMTP]
```

Domain tidak mengimpor Elysia, Drizzle, atau Nodemailer. Application tidak membaca `process.env`. Composition root ada di `src/bootstrap`.
