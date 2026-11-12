# Docker Deployment Design

## Container strategy

The project uses Docker multi-stage builds to separate build and runtime contexts for development, testing, and production use. The same application image can serve the API and worker process, while PostgreSQL runs as a separate container or external managed service depending on deployment target.

## Required files

- `Dockerfile`
- `compose.yaml`
- `compose.production.yaml`
- `.dockerignore`
- `.gitignore`
- `.env.development.example`
- `.env.test.example`
- `.env.staging.example`
- `.env.production.example`

## Multi-stage targets

### `base`
- Shared dependency installation layer
- runtime system packages and Python environment
- common application files

### `development`
- installs dev dependencies
- exposes FastAPI dev server
- runs with live reload or local dev env if enabled
- connects to local PostgreSQL service

### `test`
- installs test tooling
- points to isolated test database
- used for pytest execution in CI or local validation

### `production`
- installs only runtime dependencies
- creates non-root user
- does not include development packages
- runs production app and worker with minimal privileges

## Development deployment

### `compose.yaml`
- API service
- PostgreSQL service
- persistent database volume
- network for internal communication
- healthcheck for DB
- environment variables from `.env.development`

Example service roles:
- `api`: FastAPI service
- `postgres`: PostgreSQL container
- optional `worker`: same codebase, separate runtime command

## Production deployment

### `compose.production.yaml`
- production-grade environment values
- runtime secrets via environment or Docker secrets
- production DB external or managed service
- worker service alongside API
- explicit restart policies and health checks

## PostgreSQL requirements

- Persist data in named volume or external storage
- configure service healthcheck to validate readiness
- use environment values for credentials
- avoid development credentials in production
- keep database service isolated from app secrets when possible

## Health checks

The API container should expose health routes:
- `GET /health/live`
- `GET /health/ready`

The PostgreSQL container should validate database readiness using a command such as `pg_isready` before allowing application startup.

## Worker process design

The worker shares the same codebase and image, but runs with a different command entrypoint. This keeps the deployment model simple and reduces code duplication.

Worker responsibilities:
- poll or consume pending reminders
- create notifications
- handle restart recovery
- avoid duplicate notifications

## Secrets and environment management

- `.env.*` files should not be committed to source control.
- Example files are committed as templates only.
- Production secrets should come from environment variables or Docker secrets.
- The application must read config via `pydantic-settings` and expose a single configuration model.

## Startup and lifecycle

Recommended controls:
- explicit migration step before app startup in prod
- app uses graceful shutdown hooks
- worker process handles SIGTERM cleanly
- no distributed migration run from multiple app replicas
- restart policy pinned to `unless-stopped` or equivalent

## Deployment considerations

- run only one migration job or one active migration trigger at a time
- avoid DB migration concurrency in horizontally scaled API replicas
- use application logs for worker and API to trace startup and shutdown
- configure health probes and readiness checks for load balancing or orchestration
