#!/bin/bash
# Enable worker + Redis on Coolify staging. Run on VPS as root.
set -euo pipefail

APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
COMPOSE="$APP_DIR/docker-compose.yaml"

if [ ! -f "$COMPOSE" ]; then
  echo "Compose file not found: $COMPOSE" >&2
  exit 1
fi

python3 <<'PY'
from pathlib import Path
import re

p = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = p.read_text()

text = re.sub(
    r"\n  redis:\n    image: redis:7-alpine\n    expose:\n      - \"6379\"\n    restart: unless-stopped\n?",
    "\n",
    text,
)

if "    redis:" not in text:
    redis_svc = """    redis:
        image: redis:7-alpine
        expose:
            - '6379'
        restart: unless-stopped
        container_name: redis-z7b1ieqp66a7e43cywaz816w
        networks:
            z7b1ieqp66a7e43cywaz816w: null
"""
    text = text.replace("volumes:\n", redis_svc + "volumes:\n", 1)

if "REDIS_URL" not in text:
    text = text.replace(
        "CAS_SECRETS_KEY:",
        "REDIS_URL: 'redis://redis:6379'\n            CAS_SECRETS_KEY:",
        1,
    )

text = re.sub(r"profiles:\s*\n\s*- worker\n", "", text)

p.write_text(text)
print("Updated compose for worker + redis")
PY

cd "$APP_DIR"
docker compose config >/dev/null
docker compose up -d redis worker
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'worker|redis|api' || true

echo "Worker enabled."
