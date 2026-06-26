#!/bin/bash
set -euo pipefail

PROXY_DIR="/data/coolify/proxy"
APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
WEB="web-z7b1ieqp66a7e43cywaz816w-055922199374"

# Restore traefik compose and drop host 8080 (conflicts with CAS web)
cp "${PROXY_DIR}/docker-compose.yml.bak-no-http3" "${PROXY_DIR}/docker-compose.yml"
python3 <<'PY'
from pathlib import Path
p = Path("/data/coolify/proxy/docker-compose.yml")
text = p.read_text()
text = text.replace("      - '8080:8080'\n", "")
text = text.replace("      - '--entrypoints.https.http3'\n", "")
p.write_text(text)
print("proxy compose: no host 8080, no http3")
PY

docker stop "$WEB" 2>/dev/null || true
cd "$PROXY_DIR"
docker compose down
docker compose up -d
sleep 3

docker network connect z7b1ieqp66a7e43cywaz816w coolify-proxy 2>/dev/null || true

# Recreate web without host port binding
cp "$APP_DIR/docker-compose.yaml.bak-redeploy-21758c5" "$APP_DIR/docker-compose.yaml"
python3 <<'PY'
from pathlib import Path
p = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = p.read_text()
text = text.replace("        ports:\n            - '8080:8080'", "        expose:\n            - '8080'", 1)
p.write_text(text)
PY

cd "$APP_DIR"
docker compose -f docker-compose.yaml up -d web --no-build

# Re-apply nginx fix
docker cp /tmp/nginx.web.conf "$WEB:/etc/nginx/conf.d/default.conf"
docker exec "$WEB" nginx -s reload

sleep 3
docker ps --filter name=coolify-proxy --format '{{.Names}} {{.Ports}}'
curl -sk -o /dev/null -w "health:%{http_code}\n" https://creator-ai-studio.217.76.56.66.sslip.io/api/health

echo '{"googleOAuthClientId":"ok.apps.googleusercontent.com","googleOAuthClientSecret":"GOCSPX-oktest"}' > /tmp/patch.json
curl -sk -X PATCH "https://creator-ai-studio.217.76.56.66.sslip.io/api/secrets" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/patch.json \
  -w "\nPATCH:%{http_code}\n"
