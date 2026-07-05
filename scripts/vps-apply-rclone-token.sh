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
# Config is written to the Docker volume mounted at /config/rclone in the API container
# (Coolify names volumes like z7b1ieqp66a7e43cywaz816w_creator-ai-studio-rclone-config).
set -euo pipefail

REMOTE_NAME="${RCLONE_REMOTE_NAME:-gdrive}"
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

python3 <<'PY' "${RCLONE_OAUTH_TOKEN_JSON}"
import json, sys
raw = sys.argv[1].strip()
try:
    tok = json.loads(raw)
except json.JSONDecodeError as e:
    raise SystemExit(f"ERROR: invalid JSON token: {e}")
if not isinstance(tok, dict):
    raise SystemExit("ERROR: token JSON must be a JSON object")
if not any(k in tok for k in ("access_token", "refresh_token", "token")):
    raise SystemExit("ERROR: token JSON missing access_token/refresh_token")
print("Token JSON looks valid")
PY

if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone..."
  apt-get update -qq && apt-get install -y -qq rclone
fi

resolve_config_dirs() {
  local dirs=()
  if [ -n "${RCLONE_CONFIG_DIR:-}" ]; then
    dirs+=("${RCLONE_CONFIG_DIR}")
  else
    local api_cid mount_src
    api_cid=$(docker ps -q --filter 'name=api-' 2>/dev/null | head -1 || true)
    if [ -n "${api_cid}" ]; then
      mount_src=$(docker inspect "${api_cid}" --format '{{ range .Mounts }}{{ if eq .Destination "/config/rclone" }}{{ .Source }}{{ end }}{{ end }}' 2>/dev/null || true)
      if [ -n "${mount_src}" ]; then
        dirs+=("${mount_src}")
      fi
    fi
    while IFS= read -r d; do
      [ -n "${d}" ] && dirs+=("${d}")
    done < <(find /var/lib/docker/volumes -maxdepth 2 -type d -name '_data' 2>/dev/null \
      | grep -E 'creator-ai-studio-rclone-config/_data$' || true)
    dirs+=("/var/lib/docker/volumes/creator-ai-studio-rclone-config/_data")
  fi
  printf '%s\n' "${dirs[@]}" | awk '!seen[$0]++'
}

CONFIG_DIRS=()
while IFS= read -r d; do
  [ -n "${d}" ] && CONFIG_DIRS+=("${d}")
done < <(resolve_config_dirs)

if [ "${#CONFIG_DIRS[@]}" -eq 0 ]; then
  echo "ERROR: could not resolve rclone config directory" >&2
  exit 1
fi

PRIMARY_DIR="${CONFIG_DIRS[0]}"
PRIMARY_FILE="${PRIMARY_DIR}/rclone.conf"
mkdir -p "${PRIMARY_DIR}"
chmod 700 "${PRIMARY_DIR}"
export RCLONE_CONFIG="${PRIMARY_FILE}"

if rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
  echo "Removing existing remote '${REMOTE_NAME}' from ${PRIMARY_FILE}..."
  rclone config delete "${REMOTE_NAME}" || true
fi

echo "Creating remote '${REMOTE_NAME}' from OAuth token (primary: ${PRIMARY_FILE})..."
rclone config create "${REMOTE_NAME}" drive \
  config_token "${RCLONE_OAUTH_TOKEN_JSON}" \
  scope drive

chmod 600 "${PRIMARY_FILE}" 2>/dev/null || true

for dir in "${CONFIG_DIRS[@]:1}"; do
  mkdir -p "${dir}"
  chmod 700 "${dir}"
  cp -f "${PRIMARY_FILE}" "${dir}/rclone.conf"
  chmod 600 "${dir}/rclone.conf" 2>/dev/null || true
  echo "Synced config to ${dir}/rclone.conf"
done

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
echo "Done. Primary host config: ${PRIMARY_FILE}"
echo "Container path:          RCLONE_CONFIG=/config/rclone/rclone.conf"
echo "RCLONE_REMOTE=${REMOTE_NAME}:${REMOTE_PATH}"
