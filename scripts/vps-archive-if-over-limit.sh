#!/bin/bash
# Post-deploy relief: archive oldest published episode when over maxActiveEpisodes.
# Requires CAS_API_KEY in the environment or .env.supabase.local on the VPS.
set -euo pipefail

SRC_DIR="/root/creator-ai-studio"
DOMAIN="${CAS_PUBLIC_DOMAIN:-creator-ai-studio.217.76.56.66.sslip.io}"

if [ -f "${SRC_DIR}/.env.supabase.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(sed 's/\r$//' "${SRC_DIR}/.env.supabase.local")
  set +a
fi

if [ -z "${CAS_API_KEY:-}" ]; then
  echo "SKIP: CAS_API_KEY not set — cannot call auto-archive API"
  exit 0
fi

if [ -z "${RCLONE_REMOTE:-}" ]; then
  echo "SKIP: RCLONE_REMOTE not set — configure rclone first (scripts/vps-setup-rclone.sh)"
  exit 0
fi

echo "=== Checking storage / auto-archive ==="
response=$(curl -fsS -X POST \
  -H "Authorization: Bearer ${CAS_API_KEY}" \
  -H "Content-Type: application/json" \
  "https://${DOMAIN}/api/system/auto-archive?force=1" || true)

if [ -z "${response}" ]; then
  echo "WARN: auto-archive request failed"
  exit 0
fi

echo "${response}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
archived = data.get('archived') or []
errors = data.get('errors') or []
reason = data.get('skippedReason')
if archived:
    for item in archived:
        print(f\"Archived: {item.get('title')} -> {item.get('drivePath', '?')}\")
elif errors:
    for err in errors:
        print(f\"ERROR: {err}\")
elif reason:
    print(f\"No archive needed: {reason}\")
else:
    print(json.dumps(data, indent=2))
"
