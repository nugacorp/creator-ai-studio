#!/bin/bash
# Post-rsync cleanup on cas-core-01 deploy tree.
# Called by .github/workflows/deploy-staging.yml after rsync to /root/creator-ai-studio.
set -euo pipefail

DEPLOY_DIR="${CAS_DEPLOY_DIR:-/root/creator-ai-studio}"

if [ ! -d "${DEPLOY_DIR}" ]; then
  echo "Deploy dir missing: ${DEPLOY_DIR}" >&2
  exit 1
fi

# CI rsync excludes .git, but a manual git init/clone under /root can leave a
# root-owned .git. Hermes Agent CLI walks parents for .git when building its
# system prompt; stat() on an unreadable .git raises PermissionError and aborts.
if [ -e "${DEPLOY_DIR}/.git" ]; then
  echo "Removing ${DEPLOY_DIR}/.git (deploy sync target must not be a git checkout)"
  rm -rf "${DEPLOY_DIR}/.git"
fi

# rsync does not preserve executable bits; redeploy then fails with exit 126.
if [ -d "${DEPLOY_DIR}/scripts" ]; then
  chmod +x "${DEPLOY_DIR}/scripts/"*.sh 2>/dev/null || true
fi

echo "Post-rsync cleanup OK: ${DEPLOY_DIR}"
