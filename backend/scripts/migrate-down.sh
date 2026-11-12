#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ "${APP_ENV:-development}" == "production" && "${ALLOW_MIGRATE_DOWN:-false}" != "true" ]]; then
  echo "Refusing to run down migration in production." >&2
  echo "Set ALLOW_MIGRATE_DOWN=true only after reviewing the migration." >&2
  exit 1
fi

echo "Rolling back one migration (database: ${DB_NAME:-from DATABASE_URL})"
goose_run down "$@"
echo "Migration down completed."
