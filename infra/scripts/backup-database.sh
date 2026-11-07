#!/usr/bin/env bash
# Logical backup. Tidak menyentuh production kecuali DATABASE_NAME sudah diset operator.
set -euo pipefail

: "${DATABASE_HOST:?DATABASE_HOST wajib}"
: "${DATABASE_PORT:?DATABASE_PORT wajib}"
: "${DATABASE_USER:?DATABASE_USER wajib}"
: "${DATABASE_NAME:?DATABASE_NAME wajib}"
: "${DATABASE_PASSWORD:?DATABASE_PASSWORD wajib}"

output="${1:-backups/todo-$(date -u +%Y%m%dT%H%M%SZ).sql}"
mkdir -p "$(dirname "$output")"
export PGPASSWORD="$DATABASE_PASSWORD"
pg_dump --host="$DATABASE_HOST" --port="$DATABASE_PORT" --username="$DATABASE_USER" --dbname="$DATABASE_NAME" --format=plain --no-owner --file="$output"
unset PGPASSWORD
echo "backup written: $output"
