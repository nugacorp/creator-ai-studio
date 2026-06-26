#!/bin/bash
set -e
COMPOSE="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml"
python3 <<'PY'
from pathlib import Path
p = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = p.read_text()
bad = "CAS_SECRETS_KEY: '0.0.0.0CAS_SECRETS_KEY=lTLqLVNAHFT/dY+g59Q3DD/LPiJKnephKn4xURp5S/g='"
good = "CAS_SECRETS_KEY: 'lTLqLVNAHFT/dY+g59Q3DD/LPiJKnephKn4xURp5S/g='"
text = text.replace(bad, good)
if "CAS_PUBLIC_URL" not in text:
    text = text.replace(
        "LOCAL_STORAGE_PATH: /data/episodes",
        "LOCAL_STORAGE_PATH: /data/episodes\n            CAS_PUBLIC_URL: 'https://creator-ai-studio.217.76.56.66.sslip.io'",
    )
p.write_text(text)
print("compose fixed")
PY
