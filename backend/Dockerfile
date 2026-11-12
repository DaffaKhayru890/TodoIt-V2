FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     PIP_NO_CACHE_DIR=1     UV_SYSTEM_PYTHON=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     libpq-dev     curl     && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY README.md ./

FROM base AS development
RUN pip install --upgrade pip && pip install "uv"
COPY . .
RUN uv pip install --system --editable .[dev]
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS test
RUN pip install --upgrade pip && pip install "uv"
COPY . .
RUN uv pip install --system --editable .[dev]
CMD ["pytest"]

FROM base AS production
RUN pip install --upgrade pip && pip install "uv"
COPY . .
RUN uv pip install --system --editable .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
