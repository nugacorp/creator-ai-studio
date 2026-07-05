#!/bin/bash
set -euo pipefail
TOKEN_FILE="${1:-/tmp/rclone-oauth.json}"
PRIMARY="/var/lib/docker/volumes/z7b1ieqp66a7e43cywaz816w_creator-ai-studio-rclone-config/_data"
GENERIC="/var/lib/docker/volumes/creator-ai-studio-rclone-config/_data"
TOKEN=$(tr -d '\n\r' < "$TOKEN_FILE")
python3 <<PY
import os
from pathlib import Path
token = Path("$TOKEN_FILE").read_text().strip()
conf = "[gdrive]\ntype = drive\nscope = drive\ntoken = " + token + "\n"
for d in ["$PRIMARY", "$GENERIC"]:
    p = Path(d)
    p.mkdir(parents=True, exist_ok=True)
    f = p / "rclone.conf"
    f.write_text(conf)
    os.chmod(f, 0o600)
    print(f"Wrote {f} ({f.stat().st_size} bytes)")
PY
export RCLONE_CONFIG="$PRIMARY/rclone.conf"
echo "=== host verify ==="
rclone lsd gdrive:
rclone mkdir gdrive:Creator-AI-Studio/episodes 2>/dev/null || true
rclone lsd gdrive:Creator-AI-Studio/episodes
API=$(docker ps -q --filter name=api-z7b1ieqp66a7e43cywaz816w | sed -n '1p')
echo "API=$API"
docker exec "$API" rclone lsd gdrive:Creator-AI-Studio/episodes
