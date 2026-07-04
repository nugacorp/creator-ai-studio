#!/bin/bash
set -euo pipefail
COMPOSE="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml"
ENV_FILE="/root/creator-ai-studio/.env.supabase.local"
set -a
# shellcheck disable=SC1091
source <(sed 's/\r$//' "$ENV_FILE")
set +a
CAS_PATCH_COMPOSE="$COMPOSE" python3 <<'PY'
from pathlib import Path
import os
import re

compose_path = os.environ["CAS_PATCH_COMPOSE"]
key = os.environ.get("CAS_API_KEY", "")
if not key:
    raise SystemExit("CAS_API_KEY missing in env file")

p = Path(compose_path)
text = p.read_text()

# Locate the worker service block by indentation so the "already present" check
# scans the whole block. Splitting on "redis:" mis-detected keys declared after
# REDIS_URL and duplicated CAS_API_KEY (CAS-CURSOR-WO-0036).
m = re.search(r"(?m)^([ \t]*)worker:[ \t]*$", text)
if not m:
    raise SystemExit("worker service not found")
indent = len(m.group(1))
body_start = m.end()
end = len(text)
for lm in re.finditer(r"(?m)^([ \t]*)\S", text[body_start:]):
    if len(lm.group(1)) <= indent:
        end = body_start + lm.start()
        break
block = text[m.start():end]

if re.search(r"(?m)^[ \t]*CAS_API_KEY:", block):
    print("worker already has CAS_API_KEY")
else:
    am = re.search(r"(?m)^([ \t]*)API_BASE_URL:[^\n]*$", block)
    if not am:
        raise SystemExit("worker API_BASE_URL anchor not found")
    entry_indent = am.group(1)
    block = block[:am.end()] + "\n" + entry_indent + "CAS_API_KEY: '" + key + "'" + block[am.end():]
    p.write_text(text[:m.start()] + block + text[end:])
    print("patched worker CAS_API_KEY")
PY
cd /data/coolify/applications/z7b1ieqp66a7e43cywaz816w
docker compose --profile worker up -d worker --force-recreate
