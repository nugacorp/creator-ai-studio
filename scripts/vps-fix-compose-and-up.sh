#!/bin/bash
set -euo pipefail

APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
COMPOSE="$APP_DIR/docker-compose.yaml"
BACKUP="$APP_DIR/docker-compose.yaml.bak-redeploy-5285358"
TAG="${1:-plan-implement}"
DOMAIN="creator-ai-studio.217.76.56.66.sslip.io"

if [ -f "$BACKUP" ]; then
  cp "$BACKUP" "$COMPOSE"
  echo "Restored compose from backup"
fi

export DEPLOY_TAG="$TAG"
python3 - "$COMPOSE" <<'PY'
import os, re, sys
from pathlib import Path

tag = os.environ["DEPLOY_TAG"]
p = Path(sys.argv[1])
text = p.read_text()

redis_svc = (
    "    redis:\n"
    "        image: redis:7-alpine\n"
    "        expose:\n"
    "            - '6379'\n"
    "        restart: unless-stopped\n"
    "        container_name: redis-z7b1ieqp66a7e43cywaz816w\n"
    "        networks:\n"
    "            z7b1ieqp66a7e43cywaz816w: null\n"
)

if "    redis:" not in text:
    text = text.replace("\nvolumes:\n", "\n" + redis_svc + "volumes:\n", 1)

if "REDIS_URL" not in text:
    text = text.replace(
        "            CAS_SECRETS_KEY:",
        "            REDIS_URL: 'redis://redis:6379'\n            CAS_SECRETS_KEY:",
        1,
    )

text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_api:[^']+'", f"image: 'z7b1ieqp66a7e43cywaz816w_api:{tag}'", text)
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_web:[^']+'", f"image: 'z7b1ieqp66a7e43cywaz816w_web:{tag}'", text)
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_worker:[^']+'", f"image: 'z7b1ieqp66a7e43cywaz816w_worker:{tag}'", text)

p.write_text(text)
print("compose fixed:", tag)
PY

cd "$APP_DIR"
docker compose config >/dev/null
docker compose up -d redis api web worker --no-build

for i in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "OK: https://${DOMAIN}/api/health"
    curl -fsS "https://${DOMAIN}/api/health"
    echo
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep z7b1ieqp66a7e43cywaz816w || true
    exit 0
  fi
  sleep 2
done
exit 1
