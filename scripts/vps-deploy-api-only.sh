#!/bin/bash
set -euo pipefail
TAG=oauth-403-fix
SRC=/root/creator-ai-studio
cp /tmp/cas-oauth-fix/google-auth.ts "$SRC/apps/api/src/secrets/"
cp /tmp/cas-oauth-fix/test-connection.ts "$SRC/apps/api/src/secrets/"
cp /tmp/cas-oauth-fix/gemini.ts "$SRC/apps/api/src/ai/"
docker build -f "$SRC/deploy/Dockerfile.api" -t "z7b1ieqp66a7e43cywaz816w_api:$TAG" "$SRC"
export DEPLOY_TAG="$TAG"
python3 - "$TAG" <<'PY'
import re, sys
from pathlib import Path
tag = sys.argv[1]
p = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = p.read_text()
text = re.sub(r"image: 'z7b1ieqp66a7e43cywaz816w_api:[^']+'", f"image: 'z7b1ieqp66a7e43cywaz816w_api:{tag}'", text)
p.write_text(text)
PY
cd /data/coolify/applications/z7b1ieqp66a7e43cywaz816w
docker compose up -d api --no-build
sleep 10
curl -fsS https://creator-ai-studio.217.76.56.66.sslip.io/api/health
