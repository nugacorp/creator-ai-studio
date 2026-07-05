#!/bin/bash
# Merge Supabase/CAS env vars into /root/creator-ai-studio/.env.supabase.local.
# Only non-empty variables in the environment are written (existing values kept otherwise).
# Invoked from GitHub Actions deploy or manually on the VPS. Never prints secret values.
set -euo pipefail

ENV_FILE="${CAS_ENV_FILE:-/root/creator-ai-studio/.env.supabase.local}"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

KEYS=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  SUPABASE_JWT_SECRET
  SUPABASE_SERVICE_ROLE_KEY
  CAS_API_KEY
  CAS_SECRETS_KEY
  GEMINI_API_KEY
  RCLONE_REMOTE
  RCLONE_CONFIG
)

python3 <<'PY'
from pathlib import Path
import os

env_file = Path(os.environ.get("CAS_ENV_FILE", "/root/creator-ai-studio/.env.supabase.local"))
keys = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_JWT_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CAS_API_KEY",
    "CAS_SECRETS_KEY",
    "GEMINI_API_KEY",
    "RCLONE_REMOTE",
    "RCLONE_CONFIG",
]

existing: dict[str, str] = {}
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        existing[key.strip()] = value.strip()

updated = 0
for key in keys:
    value = os.environ.get(key, "").strip()
    if not value:
        continue
    if key == "RCLONE_REMOTE" and ("access_token" in value or value.lstrip().startswith("{")):
        print("WARNING: skipping invalid RCLONE_REMOTE (OAuth JSON belongs in RCLONE_OAUTH_TOKEN_JSON)", file=__import__("sys").stderr)
        continue
    existing[key] = value
    updated += 1

# Derive VITE_* from SUPABASE_* when only the latter are provided.
if existing.get("SUPABASE_URL") and not existing.get("VITE_SUPABASE_URL"):
    existing["VITE_SUPABASE_URL"] = existing["SUPABASE_URL"]
if existing.get("SUPABASE_ANON_KEY") and not existing.get("VITE_SUPABASE_ANON_KEY"):
    existing["VITE_SUPABASE_ANON_KEY"] = existing["SUPABASE_ANON_KEY"]

lines = ["# Managed by scripts/vps-sync-supabase-env.sh — do not commit"]
for key in keys:
    if key in existing:
        lines.append(f"{key}={existing[key]}")
# Preserve any extra keys already in the file.
for key, value in existing.items():
    if key not in keys:
        lines.append(f"{key}={value}")

env_file.write_text("\n".join(lines) + "\n")
print(f"synced {updated} key(s) into {env_file}")
PY

chmod 600 "$ENV_FILE"
