#!/bin/sh
set -eu

mkdir -p "$(dirname "$DB_PATH")" "$STORAGE_DIR"

api_target="${NEXT_API_BASE_URL:-http://127.0.0.1:${PORT:-5002}}"
api_target="${api_target%/}"
ws_target="${NEXT_WS_BASE_URL:-${NEXT_WS_URL:-$api_target}}"
ws_target="${ws_target%/}"

case "$ws_target" in
  ws://*) ws_target="http://${ws_target#ws://}" ;;
  wss://*) ws_target="https://${ws_target#wss://}" ;;
esac

cat > /etc/nginx/http.d/default.conf <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen ${FRONTEND_PORT:-3000};
  client_max_body_size 25m;

  location /api {
    proxy_pass $api_target;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /ws {
    proxy_pass $ws_target;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
  }

  location / {
    proxy_pass http://127.0.0.1:${NEXT_INTERNAL_PORT:-3001};
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

/usr/local/bin/api &
api_pid="$!"

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM

cd /app/frontend
npm start -- --hostname 127.0.0.1 --port "${NEXT_INTERNAL_PORT:-3001}" &
frontend_pid="$!"

nginx -g "daemon off;" &
nginx_pid="$!"

wait -n "$api_pid" "$frontend_pid" "$nginx_pid"
status="$?"

cleanup
kill "$frontend_pid" 2>/dev/null || true
kill "$nginx_pid" 2>/dev/null || true

exit "$status"
