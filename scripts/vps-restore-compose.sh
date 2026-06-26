#!/bin/bash
set -euo pipefail

APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
COMPOSE="$APP_DIR/docker-compose.yaml"
BACKUP="$APP_DIR/docker-compose.yaml.bak-redeploy-21758c5"
WEB="web-z7b1ieqp66a7e43cywaz816w-055922199374"

cp "$BACKUP" "$COMPOSE"

python3 <<'PY'
from pathlib import Path
p = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = p.read_text()
old = "        ports:\n            - '8080:8080'"
new = "        expose:\n            - '8080'"
if old in text:
    text = text.replace(old, new, 1)
    p.write_text(text)
    print("compose: ports -> expose")
PY

docker start "$WEB" 2>/dev/null || (cd "$APP_DIR" && docker compose -f docker-compose.yaml up -d web --no-build)

docker network connect z7b1ieqp66a7e43cywaz816w coolify-proxy 2>/dev/null || true

docker ps --filter name=coolify-proxy --format '{{.Names}} {{.Status}}'
docker ps --filter name=web-z7b1 --format '{{.Names}} {{.Status}}'

echo '{"googleOAuthClientId":"fix-test.apps.googleusercontent.com","googleOAuthClientSecret":"GOCSPX-fixtest"}' > /tmp/patch.json
curl -sk -X PATCH "https://creator-ai-studio.217.76.56.66.sslip.io/api/secrets" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/patch.json \
  -w "\nPATCH:%{http_code}\n"

curl -sk -o /dev/null -w "HEALTH:%{http_code}\n" "https://creator-ai-studio.217.76.56.66.sslip.io/api/health"
