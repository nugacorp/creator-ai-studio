## Document ID

RUNBOOK

## Title

Operations Runbook

## Version

1.0.0

## Status

Active

## Purpose

Operational procedures for deploying, monitoring, and recovering Creator AI Studio.

## Deploy to Coolify (Staging)

**Staging URL:** http://creator-ai-studio.217.76.56.66.sslip.io (Creator AI Studio)

1. Push validated changes to the `staging` branch.
2. In Coolify, trigger redeploy of the CAS stack.
3. Verify health: `curl http://creator-ai-studio.217.76.56.66.sslip.io/api/health`
4. Smoke test: create episode → edit script → generate with AI copilot.

## Environment Variables (Required for Full Functionality)

| Variable | Purpose |
|---|---|
| `LOCAL_STORAGE_PATH` | Episode filesystem storage (mount persistent volume) |
| `CAS_SECRETS_KEY` | Master key for encrypted API keys from Settings UI (32+ chars). Required to type and save keys in Configuración. |
| `GEMINI_API_KEY` | Primary AI provider (or configure via Settings UI when `CAS_SECRETS_KEY` is set) |
| `CAS_API_KEY` | Optional API authentication (worker should use same key) |
| `REDIS_URL` | Optional BullMQ queue (`redis://redis:6379` with worker profile) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Optional Postgres sync for episodes |

## Rollback

1. In Coolify, redeploy the previous successful deployment.
2. Episode data persists in the mounted volume at `LOCAL_STORAGE_PATH`.

## Rotate API Keys

1. Update keys in Coolify environment variables.
2. Redeploy API container (no code change needed).
3. Verify `/api/ai/usage` logs show the new provider responding.

## Enable Worker

```bash
Worker and Redis are included by default in `deploy/docker-compose.staging.yml`. On an existing Coolify deployment, run:

```bash
bash scripts/enable-worker-staging.sh
bash scripts/vps-redeploy.sh <tag>
```

## Redeploy (VPS) — Idempotent Env Injection

`scripts/vps-redeploy.sh` rebuilds the images and patches the Coolify-generated
runtime compose (`/data/coolify/applications/<app>/docker-compose.yaml`) with the
runtime env each service needs (`CAS_API_KEY`, `CAS_PUBLIC_URL`, `REDIS_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

That compose file is shared and survives across redeploys, so injection is
**idempotent and scoped per service**:

- A key is added to a service only when that service block does not already
  declare it. The check scans the full service block (located by indentation),
  so a key declared after `REDIS_URL` is detected correctly. The previous
  `split("redis:")` logic truncated the worker block at the `redis:` inside
  `REDIS_URL: redis://redis:6379`, missed the existing `CAS_API_KEY`, and
  duplicated it — producing an invalid YAML (CAS-HERMES-VAL-0034 /
  CAS-CURSOR-WO-0036).
- The worker shares the API's `CAS_API_KEY`; it is inserted exactly once, after
  `API_BASE_URL`.
- Before writing, the script refuses to save a compose that declares any managed
  key twice in the same service, then runs `docker compose config` as a final
  YAML gate (restoring the pre-deploy backup and aborting on failure). Secret
  values are never printed to the deploy log.

Re-running `scripts/vps-redeploy.sh` (or the helper
`scripts/patch-worker-cas-key.sh`) on an already-patched compose is a safe no-op.

### Service startup

The redeploy must bring up **every service defined in the compose** — `api`,
`web`, `redis`, and `worker` — automatically. The service list is resolved with
`docker compose -f docker-compose.yaml config --services` (indentation-proof) and
intersected with the expected set, so:

- when `redis`/`worker` exist they are started along with `api`/`web`;
- when a service is absent (e.g. an `api`+`web`-only compose) it is skipped;
- compose service order does not matter.

The earlier `grep "^[[:space:]]<svc>:"` detection required exactly one leading
space, never matched the Coolify runtime compose, and silently fell back to
`api web` — leaving `redis`/`worker` down (CAS-CURSOR-WO-0038). `docker compose
config` remains the mandatory gate before containers start. After `up`, the
script prints a sanitized per-service status (name / state / health only, no
secrets); a lagging `redis`/`worker` is surfaced as a warning but does not fail a
deploy whose `api` is already healthy.

## CI

GitHub Actions runs on push/PR to `main`, `staging`, and `feature/*`:
- `npm run typecheck`
- `npm run test`
- `npm run build`

## E2E Tests (Local)

```bash
cd apps/web
npx playwright install chromium
npx playwright test
```
