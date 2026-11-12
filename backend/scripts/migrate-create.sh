#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <migration_name>" >&2
  echo "example: $0 create_users" >&2
  exit 1
fi

NAME="$1"
if [[ ! "$NAME" =~ ^[a-z0-9_]+$ ]]; then
  echo "migration name must use lowercase letters, digits, and underscore" >&2
  exit 1
fi

if command -v goose >/dev/null 2>&1; then
  (cd "$ROOT_DIR" && goose -dir "$ROOT_DIR/migrations" create "$NAME" sql)
else
  (cd "$ROOT_DIR" && go run "github.com/pressly/goose/v3/cmd/goose@${GOOSE_VERSION}" \
    -dir "$ROOT_DIR/migrations" create "$NAME" sql)
fi
