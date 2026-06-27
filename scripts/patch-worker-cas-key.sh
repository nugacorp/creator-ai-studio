#!/bin/bash
set -euo pipefail
COMPOSE="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml"
ENV_FILE="/root/creator-ai-studio/.env.supabase.local"
set -a
# shellcheck disable=SC1091
source <(sed 's/\r$//' "$ENV_FILE")
set +a
python3 <<PY
from pathlib import Path
p = Path("$COMPOSE")
text = p.read_text()
key = "${CAS_API_KEY:-}"
if not key:
    raise SystemExit("CAS_API_KEY missing in env file")
parts = text.split("worker:", 1)
if len(parts) < 2:
    raise SystemExit("worker service not found")
worker_env, rest = parts[1].split("redis:", 1)
if "CAS_API_KEY" not in worker_env:
    worker_env = worker_env.replace(
        "API_BASE_URL: http://api:3000/api",
        f"API_BASE_URL: http://api:3000/api\n            CAS_API_KEY: '{key}'",
        1,
    )
    p.write_text(parts[0] + "worker:" + worker_env + "redis:" + rest)
    print("patched worker CAS_API_KEY")
else:
    print("worker already has CAS_API_KEY")
PY
cd /data/coolify/applications/z7b1ieqp66a7e43cywaz816w
docker compose --profile worker up -d worker --force-recreate
