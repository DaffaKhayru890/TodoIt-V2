#!/usr/bin/env bash
# Shared helper untuk script migrasi. Tidak menyimpan credential.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GOOSE_VERSION="${GOOSE_VERSION:-v3.30.0}"

# Muat env file: ENV_FILE eksplisit, atau .env.development untuk development.
ENV_FILE="${ENV_FILE:-}"
if [[ -z "$ENV_FILE" && -f "$ROOT_DIR/.env.development" ]]; then
  ENV_FILE="$ROOT_DIR/.env.development"
fi
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "env file not found: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  : "${DB_HOST:?DB_HOST is required}"
  : "${DB_PORT:=5432}"
  : "${DB_USER:?DB_USER is required}"
  : "${DB_PASSWORD:?DB_PASSWORD is required}"
  : "${DB_NAME:?DB_NAME is required}"
  : "${DB_SSLMODE:=disable}"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to URL-encode DB_PASSWORD, or set DATABASE_URL directly" >&2
    exit 1
  fi

  ENCODED_PASSWORD="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$DB_PASSWORD")"
  DATABASE_URL="postgres://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}"
fi

export DATABASE_URL

goose_run() {
  if command -v goose >/dev/null 2>&1; then
    goose -dir "$ROOT_DIR/migrations" postgres "$DATABASE_URL" "$@"
    return
  fi

  if ! command -v go >/dev/null 2>&1; then
    echo "goose CLI tidak ditemukan dan Go tidak tersedia." >&2
    echo "Install goose: go install github.com/pressly/goose/v3/cmd/goose@${GOOSE_VERSION}" >&2
    exit 1
  fi

  (cd "$ROOT_DIR" && go run "github.com/pressly/goose/v3/cmd/goose@${GOOSE_VERSION}" \
    -dir "$ROOT_DIR/migrations" postgres "$DATABASE_URL" "$@")
}
