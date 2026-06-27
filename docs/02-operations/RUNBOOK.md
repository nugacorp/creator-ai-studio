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
Worker and Redis are included by default in `docker-compose.staging.yml`. On an existing Coolify deployment, run:

```bash
bash scripts/enable-worker-staging.sh
bash scripts/vps-redeploy.sh <tag>
```

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
