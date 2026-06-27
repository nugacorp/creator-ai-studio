#!/bin/bash
set -euo pipefail

ENV_FILE="/root/creator-ai-studio/.env.supabase.local"
COMPOSE="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml"

python3 <<'PY'
from pathlib import Path
import re

def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env

env = load_env("/root/creator-ai-studio/.env.supabase.local")
url = env.get("SUPABASE_URL", "")
role = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
compose = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = compose.read_text()
if role:
    if "SUPABASE_SERVICE_ROLE_KEY" in text:
        text = re.sub(
            r"SUPABASE_SERVICE_ROLE_KEY: '[^']*'",
            f"SUPABASE_SERVICE_ROLE_KEY: '{role}'",
            text,
        )
    elif "SUPABASE_URL:" in text:
        text = text.replace(
            f"SUPABASE_URL: '{url}'",
            f"SUPABASE_URL: '{url}'\n            SUPABASE_SERVICE_ROLE_KEY: '{role}'",
            1,
        )
compose.write_text(text)
print("patched", bool(role))
PY

cd /data/coolify/applications/z7b1ieqp66a7e43cywaz816w
docker compose -f docker-compose.yaml up -d api --force-recreate --no-build

sleep 12
API=$(docker ps -q -f name=api-z7b1ieqp66a7e43cywaz816w | head -1)
if docker exec "$API" sh -c 'test -n "$SUPABASE_SERVICE_ROLE_KEY"'; then
  echo "service_role_set=yes"
else
  echo "service_role_set=no"
fi
curl -fsS "https://creator-ai-studio.217.76.56.66.sslip.io/api/health"
echo
