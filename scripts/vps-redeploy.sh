#!/bin/bash
set -euo pipefail

COMMIT="${1:-plan-implement}"
SRC_DIR="/root/creator-ai-studio"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.staging.yml}"
APP_DIR="/data/coolify/applications/z7b1ieqp66a7e43cywaz816w"
APP_ID="z7b1ieqp66a7e43cywaz816w"
DOMAIN="creator-ai-studio.217.76.56.66.sslip.io"
LOCK_FILE="${APP_DIR}/.deploy.lock"
SERVICES=(api web worker redis)
STARTED_SERVICES=()

# Serialize deploys so concurrent pushes cannot race on container names (Conflict: name already in use).
exec 9>"${LOCK_FILE}"
if ! flock -w 600 9; then
  echo "Another deploy is already running (lock timeout after 600s)" >&2
  exit 1
fi

cleanup_stale_containers() {
  echo "=== Cleaning stale Coolify app containers ==="
  cd "$APP_DIR"
  docker compose -f docker-compose.yaml down --remove-orphans 2>/dev/null || true
  for svc in "${SERVICES[@]}"; do
    ids=$(docker ps -aq --filter "name=${svc}-${APP_ID}" 2>/dev/null || true)
    if [ -n "$ids" ]; then
      echo "Removing stale ${svc} containers: $ids"
      echo "$ids" | xargs -r docker rm -f 2>/dev/null || true
    fi
  done
}

resolve_services() {
  # Ask compose which services actually exist, so redis/worker come up when
  # present and are skipped when absent. `config --services` is indentation-proof;
  # the previous `grep "^[[:space:]]svc:"` required exactly one leading space and
  # never matched the Coolify runtime compose, so the stack fell back to api+web
  # only and left redis/worker down (CAS-CURSOR-WO-0038).
  local present svc
  present=$(cd "$APP_DIR" && docker compose -f docker-compose.yaml config --services 2>/dev/null || true)
  STARTED_SERVICES=()
  for svc in "${SERVICES[@]}"; do
    if printf '%s\n' "$present" | grep -qxF "$svc"; then
      STARTED_SERVICES+=("$svc")
    fi
  done
  if [ "${#STARTED_SERVICES[@]}" -eq 0 ]; then
    echo "WARN: could not enumerate compose services; falling back to api web" >&2
    STARTED_SERVICES=(api web)
  fi
}

compose_up() {
  local attempt
  cd "$APP_DIR"
  resolve_services

  for attempt in 1 2 3; do
    echo "=== Starting stack (attempt ${attempt}): ${STARTED_SERVICES[*]} ==="
    if docker compose -f docker-compose.yaml up -d --force-recreate --remove-orphans "${STARTED_SERVICES[@]}" --no-build; then
      return 0
    fi
    echo "docker compose up failed (attempt ${attempt}), cleaning conflicting containers..." >&2
    cleanup_stale_containers
    sleep 2
  done
  echo "docker compose up failed after 3 attempts" >&2
  return 1
}

verify_services() {
  # Sanitized post-up check: report each started service's container state (and
  # health when defined). Prints only service name/state/health -- never env or
  # secrets. Returns non-zero if any started service is not running.
  echo "=== Service status ==="
  local svc cid state health tries rc=0
  cd "$APP_DIR"
  for svc in "${STARTED_SERVICES[@]}"; do
    cid=""
    for tries in 1 2 3 4 5; do
      cid=$(docker compose -f docker-compose.yaml ps -q "$svc" 2>/dev/null | head -1 || true)
      if [ -n "$cid" ]; then
        state=$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)
        [ "$state" = "running" ] && break
      fi
      sleep 2
    done
    if [ -z "$cid" ]; then
      printf '  %-8s %s\n' "$svc" "MISSING (no container)"
      rc=1
      continue
    fi
    state=$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)
    health=$(docker inspect -f '{{if .State.Health}} health={{.State.Health.Status}}{{end}}' "$cid" 2>/dev/null || true)
    printf '  %-8s %s%s\n' "$svc" "$state" "$health"
    [ "$state" = "running" ] || rc=1
  done
  return $rc
}

if [ -f "$SRC_DIR/.env.supabase.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(sed 's/\r$//' "$SRC_DIR/.env.supabase.local")
  set +a
fi

# Web build args: accept VITE_* or derive from SUPABASE_URL / SUPABASE_ANON_KEY.
if [ -z "${VITE_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_URL:-}" ]; then
  export VITE_SUPABASE_URL="$SUPABASE_URL"
fi
if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  export VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
fi
if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ] && [ -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  export VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"
fi

VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"

if [ -n "${SUPABASE_JWT_SECRET:-}" ]; then
  if [ -z "${VITE_SUPABASE_URL}" ] || [ -z "${VITE_SUPABASE_ANON_KEY}" ]; then
    echo "ERROR: SUPABASE_JWT_SECRET is set (API auth on) but web build args are missing." >&2
    echo "  Add to /root/creator-ai-studio/.env.supabase.local (or GitHub Actions secrets):" >&2
    echo "    SUPABASE_URL=https://iiokqyedkylwhonbrrvo.supabase.co" >&2
    echo "    SUPABASE_ANON_KEY=<Dashboard → Settings → API → anon / publishable key>" >&2
    echo "  vps-sync-supabase-env.sh derives VITE_SUPABASE_* from those keys." >&2
    echo "  See docs/02-operations/SUPABASE_AUTH.md" >&2
    exit 1
  fi
fi

echo "=== Migrating secrets to persistent volume ==="
API_CONTAINER=$(docker ps -q -f name=api-z7b1ieqp66a7e43cywaz816w | head -1 || true)
if [ -n "$API_CONTAINER" ]; then
  docker exec "$API_CONTAINER" sh -c '
    if [ -f /data/secrets.enc ] && [ ! -f /data/episodes/.secrets/secrets.enc ]; then
      mkdir -p /data/episodes/.secrets
      cp /data/secrets.enc /data/episodes/.secrets/secrets.enc
      echo "Migrated /data/secrets.enc -> /data/episodes/.secrets/secrets.enc"
    fi
    if [ -f /data/settings.json ] && [ ! -f /data/episodes/settings.json ]; then
      cp /data/settings.json /data/episodes/settings.json
      echo "Migrated settings.json into episodes volume"
    fi
  ' || true
fi

echo "=== Redeploy (${COMMIT}) — repo compose: ${COMPOSE_FILE} ==="

echo "=== Building API image (${COMMIT}) ==="
docker build -f "$SRC_DIR/deploy/Dockerfile.api" -t "z7b1ieqp66a7e43cywaz816w_api:${COMMIT}" "$SRC_DIR"

echo "=== Building Web image (${COMMIT}) ==="
# Vite bakes VITE_* at build time — these must be passed as docker build --build-arg.
WEB_BUILD_ARGS=(--build-arg "VITE_API_BASE_URL=/api")
if [ -n "${VITE_SUPABASE_URL}" ]; then
  WEB_BUILD_ARGS+=(--build-arg "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}")
fi
if [ -n "${VITE_SUPABASE_ANON_KEY}" ]; then
  WEB_BUILD_ARGS+=(--build-arg "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}")
fi
if [ -n "${SUPABASE_URL:-}" ] && [ -z "${VITE_SUPABASE_ANON_KEY}" ]; then
  echo "WARN: SUPABASE_URL is set but VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY is missing; web login will be disabled" >&2
fi
if [ -n "${VITE_SUPABASE_URL}" ]; then
  echo "Web build: VITE_SUPABASE_URL set (anon key: $([ -n "${VITE_SUPABASE_ANON_KEY}" ] && echo yes || echo MISSING))"
else
  echo "Web build: no VITE_SUPABASE_URL — login UI will not be baked into the dashboard"
fi
WEB_IMAGE="z7b1ieqp66a7e43cywaz816w_web:${COMMIT}"
docker build -f "$SRC_DIR/deploy/Dockerfile.web" \
  "${WEB_BUILD_ARGS[@]}" \
  -t "$WEB_IMAGE" \
  "$SRC_DIR"

if [ -n "${VITE_SUPABASE_URL}" ]; then
  HOST_FRAGMENT="${VITE_SUPABASE_URL#https://}"
  HOST_FRAGMENT="${HOST_FRAGMENT#http://}"
  if ! docker run --rm "$WEB_IMAGE" \
    sh -c "grep -rq '${HOST_FRAGMENT}' /usr/share/nginx/html/assets/ 2>/dev/null"; then
    echo "ERROR: Web image built but VITE_SUPABASE_URL was not embedded in static assets." >&2
    echo "  Check deploy/Dockerfile.web ARG/ENV and rebuild with --build-arg VITE_SUPABASE_URL." >&2
    exit 1
  fi
  echo "OK: VITE_SUPABASE_URL embedded in web assets"
fi

echo "=== Building Worker image (${COMMIT}) ==="
docker build -f "$SRC_DIR/deploy/Dockerfile.worker" -t "z7b1ieqp66a7e43cywaz816w_worker:${COMMIT}" "$SRC_DIR"

COMPOSE="$APP_DIR/docker-compose.yaml"
cp "$COMPOSE" "${COMPOSE}.bak-redeploy-${COMMIT}"

echo "=== Injecting runtime env into compose (idempotent) ==="
# The runtime compose is Coolify-generated and shared across redeploys, so every
# injection below must be idempotent: add a key only if that service does not
# already declare it. See CAS-CURSOR-WO-0036 (duplicate CAS_API_KEY in worker).
CAS_REDEPLOY_COMMIT="$COMMIT" \
CAS_REDEPLOY_DOMAIN="$DOMAIN" \
CAS_REDEPLOY_COMPOSE="$COMPOSE" \
python3 <<'PY'
from pathlib import Path
import os
import re

commit = os.environ["CAS_REDEPLOY_COMMIT"]
domain = os.environ["CAS_REDEPLOY_DOMAIN"]
compose_path = os.environ["CAS_REDEPLOY_COMPOSE"]
supabase_url = os.environ.get("SUPABASE_URL") or "https://iiokqyedkylwhonbrrvo.supabase.co"
service_role = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
cas_api_key = os.environ.get("CAS_API_KEY", "")
cas_secrets_key = os.environ.get("CAS_SECRETS_KEY", "")
gemini_api_key = os.environ.get("GEMINI_API_KEY", "")

p = Path(compose_path)
text = p.read_text()

# --- bump image tags ---
def bump_image(text, name):
    return re.sub(r"image: '" + re.escape(name) + r":[^']+'",
                  "image: '" + name + ":" + commit + "'", text)

text = bump_image(text, "z7b1ieqp66a7e43cywaz816w_api")
text = bump_image(text, "z7b1ieqp66a7e43cywaz816w_web")
if "z7b1ieqp66a7e43cywaz816w_worker:" in text:
    text = bump_image(text, "z7b1ieqp66a7e43cywaz816w_worker")

# --- idempotent, per-service env injection ---
def find_service_block(text, service):
    """Return (start, end, indent) of a service block, matched by its header line.

    The block ends at the next line whose indentation is <= the header's, so it
    spans the whole service (environment, volumes, depends_on, ...)."""
    m = re.search(r"(?m)^([ \t]*)" + re.escape(service) + r":[ \t]*$", text)
    if not m:
        return None
    indent = len(m.group(1))
    body_start = m.end()
    end = len(text)
    for lm in re.finditer(r"(?m)^([ \t]*)\S", text[body_start:]):
        if len(lm.group(1)) <= indent:
            end = body_start + lm.start()
            break
    return m.start(), end, indent

def count_key(block, key):
    return len(re.findall(r"(?m)^[ \t]*" + re.escape(key) + r":", block))

def inject_env(text, service, key, value, anchor):
    """Add `key: 'value'` after `anchor` inside `service`, only if `key` is absent
    from that service block. Scanning the whole block (not a truncated slice) is
    what keeps this from re-adding a key that sits after REDIS_URL/redis:."""
    blk = find_service_block(text, service)
    if blk is None:
        return text
    start, end, _ = blk
    block = text[start:end]
    if count_key(block, key) > 0:
        return text
    am = re.search(r"(?m)^([ \t]*)" + re.escape(anchor) + r":[^\n]*$", block)
    if not am:
        return text
    indent = am.group(1)
    new_block = block[:am.end()] + "\n" + indent + key + ": '" + value + "'" + block[am.end():]
    return text[:start] + new_block + text[end:]

# API service runtime env.
text = inject_env(text, "api", "CAS_PUBLIC_URL", "https://" + domain, "LOCAL_STORAGE_PATH")
text = inject_env(text, "api", "SUPABASE_URL", supabase_url, "LOCAL_STORAGE_PATH")
if jwt_secret:
    text = inject_env(text, "api", "SUPABASE_JWT_SECRET", jwt_secret, "SUPABASE_URL")
if service_role:
    text = inject_env(text, "api", "SUPABASE_SERVICE_ROLE_KEY", service_role, "SUPABASE_URL")
if cas_secrets_key:
    text = inject_env(text, "api", "CAS_SECRETS_KEY", cas_secrets_key, "LOCAL_STORAGE_PATH")
text = inject_env(text, "api", "REDIS_URL", "redis://redis:6379", "CAS_SECRETS_KEY")
if gemini_api_key:
    text = inject_env(text, "api", "GEMINI_API_KEY", gemini_api_key, "LOCAL_STORAGE_PATH")
if cas_api_key:
    text = inject_env(text, "api", "CAS_API_KEY", cas_api_key, "CAS_SECRETS_KEY")
    # Worker must share the API key; inject once, never duplicate (CAS-CURSOR-WO-0036).
    text = inject_env(text, "worker", "CAS_API_KEY", cas_api_key, "API_BASE_URL")

# Idempotency guard: refuse to write a compose that declares a managed key twice
# in the same service (this is the failure the work order fixes). No secret
# values are printed -- only the offending service/key name.
managed = ("CAS_API_KEY", "CAS_PUBLIC_URL", "CAS_SECRETS_KEY", "GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_JWT_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "REDIS_URL")
for service in ("api", "worker"):
    blk = find_service_block(text, service)
    if blk is None:
        continue
    s, e, _ = blk
    body = text[s:e]
    for key in managed:
        n = count_key(body, key)
        if n > 1:
            raise SystemExit(
                "Refusing to write compose: service '%s' declares '%s' %d times" % (service, key, n)
            )

# Structural YAML sanity check when PyYAML is available (never prints values).
try:
    import yaml
    yaml.safe_load(text)
except ImportError:
    pass
except Exception as exc:  # noqa: BLE001 - surface any parse error, keep the message secret-free
    raise SystemExit("Compose YAML failed to parse after injection: %s" % exc)

p.write_text(text)
print("compose images + runtime env updated (idempotent)")
PY

echo "=== Validating compose YAML ==="
# Defense in depth: docker compose is the real consumer and rejects duplicate
# mapping keys. Output is discarded so expanded secrets never reach the log.
if ! ( cd "$APP_DIR" && docker compose -f docker-compose.yaml config >/dev/null ); then
  echo "Compose validation failed after injection; restoring backup and aborting" >&2
  cp "${COMPOSE}.bak-redeploy-${COMMIT}" "$COMPOSE"
  exit 1
fi

cleanup_stale_containers
compose_up

echo "=== Waiting for API health ==="
for i in $(seq 1 30); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "OK: https://${DOMAIN}/api/health"
    curl -fsS "https://${DOMAIN}/api/health"
    echo
    # api is healthy (deploy gate). Report every started service; a lagging
    # redis/worker is surfaced as a warning but does not fail a healthy deploy.
    verify_services || echo "WARN: not all services are running yet; see status above" >&2
    exit 0
  fi
  sleep 2
done

echo "Health check failed" >&2
verify_services || true
exit 1
