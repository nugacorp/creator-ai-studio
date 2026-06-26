#!/bin/bash
set -e
DOMAIN="creator-ai-studio.217.76.56.66.sslip.io"
API="api-z7b1ieqp66a7e43cywaz816w-055922164564"

echo "=== PATCH via HTTPS (traefik) ==="
curl -sk -X PATCH "https://127.0.0.1/api/secrets" \
  -H "Host: ${DOMAIN}" \
  -H "Content-Type: application/json" \
  -d '{"googleOAuthClientId":"test-id.apps.googleusercontent.com"}' \
  -w "\nHTTP:%{http_code}\n" || true

echo "=== PATCH direct API ==="
docker exec "$API" node <<'NODE'
fetch('http://127.0.0.1:3000/api/secrets', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ googleOAuthClientId: 'test-id.apps.googleusercontent.com' }),
})
  .then(async (r) => console.log('status', r.status, await r.text()))
  .catch((e) => console.error('error', e));
NODE

echo "=== API logs after PATCH ==="
docker logs "$API" --tail 15 2>&1
