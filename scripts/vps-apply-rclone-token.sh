#!/bin/bash
# Apply rclone Google Drive OAuth token on the VPS (non-interactive).
#
# Token: output of `rclone authorize drive` on a machine with a browser (single-line JSON).
#
# Usage (on VPS as root):
#   RCLONE_OAUTH_TOKEN_JSON='{"access_token":"...",...}' \
#     bash /root/creator-ai-studio/scripts/vps-apply-rclone-token.sh
#
# Or from a file:
#   RCLONE_OAUTH_TOKEN_FILE=/tmp/rclone-oauth.json bash ...
#
# Config is written to the Docker volume used by API/worker containers:
#   /var/lib/docker/volumes/creator-ai-studio-rclone-config/_data/rclone.conf
#
# Containers read it at RCLONE_CONFIG=/config/rclone/rclone.conf (same volume mount).
set -euo pipefail

REMOTE_NAME="${RCLONE_REMOTE_NAME:-gdrive}"
CONFIG_DIR="${RCLONE_CONFIG_DIR:-/var/lib/docker/volumes/creator-ai-studio-rclone-config/_data}"
CONFIG_FILE="${CONFIG_DIR}/rclone.conf"
REMOTE_PATH="${RCLONE_REMOTE_PATH:-Creator-AI-Studio/episodes}"
ENV_FILE="${RCLONE_ENV_FILE:-/root/creator-ai-studio/.env.supabase.local}"

if [ -n "${RCLONE_OAUTH_TOKEN_FILE:-}" ]; then
  if [ ! -f "${RCLONE_OAUTH_TOKEN_FILE}" ]; then
    echo "ERROR: RCLONE_OAUTH_TOKEN_FILE not found: ${RCLONE_OAUTH_TOKEN_FILE}" >&2
    exit 1
  fi
  RCLONE_OAUTH_TOKEN_JSON="$(tr -d '\n\r' < "${RCLONE_OAUTH_TOKEN_FILE}")"
fi

if [ -z "${RCLONE_OAUTH_TOKEN_JSON:-}" ]; then
  echo "ERROR: Set RCLONE_OAUTH_TOKEN_JSON or RCLONE_OAUTH_TOKEN_FILE" >&2
  exit 1
fi

python3 -c '
import json, os, sys
raw = os.environ.get("RCLONE_OAUTH_TOKEN_JSON", "").strip()
try:
    tok = json.loads(raw)
except json.JSONDecodeError as e:
    raise SystemExit(f"ERROR: invalid JSON token: {e}")
if not isinstance(tok, dict):
    raise SystemExit("ERROR: token JSON must be a JSON object")
if not any(k in tok for k in ("access_token", "refresh_token", "token")):
    raise SystemExit("ERROR: token JSON missing access_token/refresh_token")
print("Token JSON looks valid")
'

if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone..."
  apt-get update -qq && apt-get install -y -qq rclone
fi

mkdir -p "${CONFIG_DIR}"
chmod 700 "${CONFIG_DIR}"
export RCLONE_CONFIG="${CONFIG_FILE}"

if rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
  echo "Removing existing remote '${REMOTE_NAME}'..."
  rclone config delete "${REMOTE_NAME}" || true
fi

echo "Creating remote '${REMOTE_NAME}' from OAuth token..."
rclone config create "${REMOTE_NAME}" drive \
  config_token "${RCLONE_OAUTH_TOKEN_JSON}" \
  scope drive

chmod 600 "${CONFIG_FILE}" 2>/dev/null || true

echo "=== Verifying remote ==="
rclone lsd "${REMOTE_NAME}:"

echo "=== Ensuring archive folder exists ==="
rclone mkdir "${REMOTE_NAME}:${REMOTE_PATH}" 2>/dev/null || true
rclone lsd "${REMOTE_NAME}:${REMOTE_PATH}" || rclone mkdir "${REMOTE_NAME}:${REMOTE_PATH}"

touch "${ENV_FILE}"
python3 <<PY
from pathlib import Path
env = Path("${ENV_FILE}")
lines = env.read_text().splitlines() if env.exists() else []
kv = {}
for line in lines:
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    kv[k.strip()] = v.strip()
kv["RCLONE_REMOTE"] = "${REMOTE_NAME}:${REMOTE_PATH}"
kv["RCLONE_CONFIG"] = "/config/rclone/rclone.conf"
out = ["# Managed by scripts/vps-apply-rclone-token.sh — do not commit"]
for k in sorted(kv):
    out.append(f"{k}={kv[k]}")
env.write_text("\\n".join(out) + "\\n")
print(f"Updated {env}")
PY
chmod 600 "${ENV_FILE}"

echo
echo "Done. Host config: ${CONFIG_FILE}"
echo "Container path:   RCLONE_CONFIG=/config/rclone/rclone.conf"
echo "RCLONE_REMOTE=${REMOTE_NAME}:${REMOTE_PATH}"