#!/bin/sh
set -eu

mkdir -p "$(dirname "$DB_PATH")" "$STORAGE_DIR"

/usr/local/bin/api &
api_pid="$!"

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM

cd /app/frontend
npm start -- --hostname 0.0.0.0 --port "$FRONTEND_PORT" &
frontend_pid="$!"

wait -n "$api_pid" "$frontend_pid"
status="$?"

cleanup
kill "$frontend_pid" 2>/dev/null || true

exit "$status"
