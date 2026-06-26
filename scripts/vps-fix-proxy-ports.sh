#!/bin/bash
set -euo pipefail

APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
COMPOSE="$APP_DIR/docker-compose.yaml"
WEB="web-z7b1ieqp66a7e43cywaz816w-055922199374"

python3 <<'PY'
from pathlib import Path
import re
p = Path("/data/coolify/applications/z7b1ieqp66a7e43cywaz816w/docker-compose.yaml")
text = p.read_text()
if "8080:8080" in text:
    text = re.sub(r"\n\s+ports:\n\s+- '8080:8080'\n", "\n    expose:\n      - '8080'\n", text, count=1)
    p.write_text(text)
    print("web: removed host port 8080")
else:
    print("web: already using expose")
PY

docker stop "$WEB" 2>/dev/null || true

cd /data/coolify/proxy
docker compose up -d
sleep 2
docker ps --filter name=coolify-proxy --format '{{.Names}} {{.Status}}'

cd "$APP_DIR"
docker compose -f docker-compose.yaml up -d web --no-build
sleep 2

echo '{"googleOAuthClientId":"fix-test.apps.googleusercontent.com","googleOAuthClientSecret":"GOCSPX-fixtest"}' > /tmp/patch.json
curl -sk -X PATCH "https://creator-ai-studio.217.76.56.66.sslip.io/api/secrets" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/patch.json \
  -w "\nPATCH HTTP:%{http_code}\n"

curl -sk -o /dev/null -w "health HTTP:%{http_code}\n" "https://creator-ai-studio.217.76.56.66.sslip.io/api/health"
