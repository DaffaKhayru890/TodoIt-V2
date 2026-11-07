#!/usr/bin/env bash
# Restore hanya ke target yang disebutkan eksplisit. Menolak nama yang mengandung production
# kecuali RESTORE_I_UNDERSTAND=yes.
set -euo pipefail

backup="${1:?path backup wajib}"
: "${RESTORE_TARGET:?RESTORE_TARGET wajib, contoh todo_restore_drill}"

if [[ "$RESTORE_TARGET" == *production* && "${RESTORE_I_UNDERSTAND:-}" != "yes" ]]; then
  echo "restore ke target production ditolak" >&2
  exit 1
fi

if [[ ! -f "$backup" ]]; then
  echo "file backup tidak ditemukan" >&2
  exit 1
fi

: "${DATABASE_HOST:?}"
: "${DATABASE_PORT:?}"
: "${DATABASE_USER:?}"
: "${DATABASE_PASSWORD:?}"

export PGPASSWORD="$DATABASE_PASSWORD"
psql --host="$DATABASE_HOST" --port="$DATABASE_PORT" --username="$DATABASE_USER" --dbname=postgres --command="DROP DATABASE IF EXISTS \"${RESTORE_TARGET}\";"
psql --host="$DATABASE_HOST" --port="$DATABASE_PORT" --username="$DATABASE_USER" --dbname=postgres --command="CREATE DATABASE \"${RESTORE_TARGET}\";"
psql --host="$DATABASE_HOST" --port="$DATABASE_PORT" --username="$DATABASE_USER" --dbname="$RESTORE_TARGET" --file="$backup"
unset PGPASSWORD
echo "restored into $RESTORE_TARGET"
