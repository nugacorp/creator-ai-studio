#!/bin/bash
set -euo pipefail

COMMIT="${1:-21758c5}"
SRC_DIR="/root/creator-ai-studio"
APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
DOMAIN="creator-ai-studio.217.76.56.66.sslip.io"

echo "=== Building API image (${COMMIT}) ==="
docker build -f "$SRC_DIR/Dockerfile.api" -t "z7b1ieqp66a7e43cywaz816w_api:${COMMIT}" "$SRC_DIR"

echo "=== Building Web image (${COMMIT}) ==="
docker build -f "$SRC_DIR/Dockerfile.web" \
  --build-arg VITE_API_BASE_URL=/api \
  -t "z7b1ieqp66a7e43cywaz816w_web:${COMMIT}" \
  "$SRC_DIR"

COMPOSE="$APP_DIR/docker-compose.yaml"
cp "$COMPOSE" "${COMPOSE}.bak-redeploy-${COMMIT}"

python3 <<PY
from pathlib import Path
import re
p = Path("$COMPOSE")
text = p.read_text()
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_api:[^']+'", "image: 'z7b1ieqp66a7e43cywaz816w_api:${COMMIT}'", text)
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_web:[^']+'", "image: 'z7b1ieqp66a7e43cywaz816w_web:${COMMIT}'", text)
if "CAS_PUBLIC_URL" not in text:
    text = text.replace(
        "LOCAL_STORAGE_PATH: /data/episodes",
        "LOCAL_STORAGE_PATH: /data/episodes\n            CAS_PUBLIC_URL: 'https://${DOMAIN}'",
        1,
    )
p.write_text(text)
print("compose images updated")
PY

cd "$APP_DIR"
docker compose -f docker-compose.yaml up -d api web --no-build

echo "=== Waiting for API health ==="
for i in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "OK: https://${DOMAIN}/api/health"
    curl -fsS "https://${DOMAIN}/api/health"
    echo
  exit 0
  fi
  sleep 2
done

echo "Health check failed" >&2
docker ps --filter name=z7b1ieqp66a7e43cywaz816w
exit 1
