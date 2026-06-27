#!/bin/bash
set -euo pipefail

COMMIT="${1:-plan-implement}"
SRC_DIR="/root/creator-ai-studio"
APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
DOMAIN="creator-ai-studio.217.76.56.66.sslip.io"

if [ -f "$SRC_DIR/.env.supabase.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(sed 's/\r$//' "$SRC_DIR/.env.supabase.local")
  set +a
fi

echo "=== Migrating secrets to persistent volume ==="
API_CONTAINER=$(docker ps -q -f name=api-z7b1ieqp66a7e43cywaz816w | head -1 || true)
if [ -n "$API_CONTAINER" ]; then
  docker exec "$API_CONTAINER" sh -c '
    if [ -f /data/secrets.enc ] && [ ! -f /data/episodes/.secrets/secrets.enc ]; then
      mkdir -p /data/episodes/.secrets
      cp /data/secrets.enc /data/episodes/.secrets/secrets.enc
      echo "Migrated /data/secrets.enc -> /data/episodes/.secrets/secrets.enc"
    fi
    if [ -f /data/settings.json ] && [ ! -f /data/episodes/settings.json ]; then
      cp /data/settings.json /data/episodes/settings.json
      echo "Migrated settings.json into episodes volume"
    fi
  ' || true
fi

echo "=== Building API image (${COMMIT}) ==="
docker build -f "$SRC_DIR/Dockerfile.api" -t "z7b1ieqp66a7e43cywaz816w_api:${COMMIT}" "$SRC_DIR"

echo "=== Building Web image (${COMMIT}) ==="
WEB_BUILD_ARGS=(--build-arg "VITE_API_BASE_URL=/api")
if [ -n "${VITE_SUPABASE_URL:-}" ]; then
  WEB_BUILD_ARGS+=(--build-arg "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}")
fi
if [ -n "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  WEB_BUILD_ARGS+=(--build-arg "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}")
fi
docker build -f "$SRC_DIR/Dockerfile.web" \
  "${WEB_BUILD_ARGS[@]}" \
  -t "z7b1ieqp66a7e43cywaz816w_web:${COMMIT}" \
  "$SRC_DIR"

echo "=== Building Worker image (${COMMIT}) ==="
docker build -f "$SRC_DIR/Dockerfile.worker" -t "z7b1ieqp66a7e43cywaz816w_worker:${COMMIT}" "$SRC_DIR"

COMPOSE="$APP_DIR/docker-compose.yaml"
cp "$COMPOSE" "${COMPOSE}.bak-redeploy-${COMMIT}"

python3 <<PY
from pathlib import Path
import re
import os
p = Path("$COMPOSE")
text = p.read_text()
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_api:[^']+'", "image: 'z7b1ieqp66a7e43cywaz816w_api:${COMMIT}'", text)
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_web:[^']+'", "image: 'z7b1ieqp66a7e43cywaz816w_web:${COMMIT}'", text)
if "z7b1ieqp66a7e43cywaz816w_worker:" in text:
    text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_worker:[^']+'", "image: 'z7b1ieqp66a7e43cywaz816w_worker:${COMMIT}'", text)
if "CAS_PUBLIC_URL" not in text:
    text = text.replace(
        "LOCAL_STORAGE_PATH: /data/episodes",
        "LOCAL_STORAGE_PATH: /data/episodes\n            CAS_PUBLIC_URL: 'https://${DOMAIN}'",
        1,
    )
if "REDIS_URL" not in text and "environment:" in text:
    text = text.replace(
        "CAS_SECRETS_KEY:",
        "REDIS_URL: 'redis://redis:6379'\n            CAS_SECRETS_KEY:",
        1,
    )
supabase_url = os.environ.get("SUPABASE_URL", "https://iiokqyedkylwhonbrrvo.supabase.co")
service_role = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
cas_api_key = os.environ.get("CAS_API_KEY", "")
if "SUPABASE_URL" not in text:
    text = text.replace(
        "CAS_PUBLIC_URL:",
        f"SUPABASE_URL: '{supabase_url}'\n            CAS_PUBLIC_URL:",
        1,
    )
if service_role and "SUPABASE_SERVICE_ROLE_KEY" not in text:
    text = text.replace(
        f"SUPABASE_URL: '{supabase_url}'",
        f"SUPABASE_URL: '{supabase_url}'\n            SUPABASE_SERVICE_ROLE_KEY: '{service_role}'",
        1,
    )
if cas_api_key and "CAS_API_KEY" not in text:
    text = text.replace(
        "CAS_SECRETS_KEY:",
        f"CAS_API_KEY: '{cas_api_key}'\n            CAS_SECRETS_KEY:",
        1,
    )
if cas_api_key and "worker:" in text and "CAS_API_KEY" not in text.split("worker:")[1][:800]:
    text = text.replace(
        "API_BASE_URL: 'http://api:3000/api'",
        f"API_BASE_URL: 'http://api:3000/api'\n            CAS_API_KEY: '{cas_api_key}'",
        1,
    )
p.write_text(text)
print("compose images updated")
PY

cd "$APP_DIR"
docker compose -f docker-compose.yaml up -d redis worker api web --no-build 2>/dev/null || \
  docker compose -f docker-compose.yaml up -d api web --no-build

echo "=== Waiting for API health ==="
for i in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "OK: https://${DOMAIN}/api/health"
    curl -fsS "https://${DOMAIN}/api/health"
    echo
    docker ps --format 'table {{.Names}}\t{{.Status}}' | grep z7b1ieqp66a7e43cywaz816w || true
    exit 0
  fi
  sleep 2
done

echo "Health check failed" >&2
docker ps --filter name=z7b1ieqp66a7e43cywaz816w
exit 1
