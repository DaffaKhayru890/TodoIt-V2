#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

echo "Running migrations up (database: ${DB_NAME:-from DATABASE_URL})"
goose_run up "$@"
echo "Migrations up completed."
