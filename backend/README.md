# TodoIt V2 Backend

This backend package contains the foundation for the TodoIt V2 modular monolith service.

## Stack
- Python 3.12+
- FastAPI
- SQLAlchemy 2.x (async)
- PostgreSQL
- Alembic
- Pydantic v2
- Docker / Compose

## Quick start

1. Copy one of the env templates to `.env` for the environment you want to run.
2. Install dependencies with `uv sync --all-extras` or `pip install -e .[dev]`.
3. Start the app with:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Health endpoints
- `/health/live`
- `/health/ready`

## Notes
The project intentionally contains only the foundation layer for later auth, workspace, and todo features.
