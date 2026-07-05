#!/bin/bash
# One-time rclone Google Drive setup on the Creator AI Studio VPS.
# Run interactively on the VPS (SSH) — OAuth requires a browser.
# Non-interactive alternative: scripts/vps-apply-rclone-token.sh or
# GitHub Actions workflow setup-rclone-vps.yml (see docs/02-operations/RCLONE_DRIVE.md).
#
# Usage:
#   bash /root/creator-ai-studio/scripts/vps-setup-rclone.sh
#
# After setup, set in /root/creator-ai-studio/.env.supabase.local:
#   RCLONE_REMOTE=gdrive:Creator-AI-Studio/episodes
#   RCLONE_CONFIG=/config/rclone/rclone.conf
#
# Then redeploy (push to staging or run scripts/vps-redeploy.sh).
set -euo pipefail

REMOTE_NAME="${RCLONE_REMOTE_NAME:-gdrive}"
CONFIG_DIR="${RCLONE_CONFIG_DIR:-/var/lib/docker/volumes/creator-ai-studio-rclone-config/_data}"
CONFIG_FILE="${CONFIG_DIR}/rclone.conf"
REMOTE_PATH="${RCLONE_REMOTE_PATH:-Creator-AI-Studio/episodes}"

echo "=== Creator AI Studio — rclone Google Drive setup ==="
echo "Remote name: ${REMOTE_NAME}"
echo "Config file: ${CONFIG_FILE}"
echo "Drive folder:  ${REMOTE_PATH}"
echo

if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone..."
  apt-get update -qq && apt-get install -y -qq rclone
fi

mkdir -p "${CONFIG_DIR}"
export RCLONE_CONFIG="${CONFIG_FILE}"

if [ -f "${CONFIG_FILE}" ] && rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
  echo "Remote '${REMOTE_NAME}' already exists in ${CONFIG_FILE}"
else
  echo "Starting interactive rclone config (choose Google Drive, name it '${REMOTE_NAME}')..."
  rclone config
fi

echo
echo "=== Verifying remote ==="
rclone lsd "${REMOTE_NAME}:" || { echo "Remote not reachable"; exit 1; }

echo "=== Ensuring archive folder exists ==="
rclone mkdir "${REMOTE_NAME}:${REMOTE_PATH}" 2>/dev/null || true
rclone lsd "${REMOTE_NAME}:${REMOTE_PATH}" || rclone mkdir "${REMOTE_NAME}:${REMOTE_PATH}"

ENV_FILE="/root/creator-ai-studio/.env.supabase.local"
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
out = ["# Managed by scripts/vps-setup-rclone.sh — do not commit"]
for k in sorted(kv):
    out.append(f"{k}={kv[k]}")
env.write_text("\\n".join(out) + "\\n")
print(f"Updated {env}")
PY
chmod 600 "${ENV_FILE}"

echo
echo "Done. RCLONE_REMOTE=${REMOTE_NAME}:${REMOTE_PATH}"
echo "Redeploy staging so the API container picks up the env and mounts the config volume."
