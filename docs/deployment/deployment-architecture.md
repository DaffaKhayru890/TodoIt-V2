# Arsitektur deployment

```text
Internet -> reverse proxy TLS -> API container -> PostgreSQL
                                 API container -> SMTP
                                 Worker container -> PostgreSQL dan SMTP
```

API dan worker memakai image yang sama dan proses berbeda. Compose satu host bukan high availability.

Development memakai `compose.yaml`: postgres, backend, worker, mailpit. Production memakai `compose.production.yaml`: API dan worker, database hanya lewat profil `self-hosted-db` tanpa port host.
