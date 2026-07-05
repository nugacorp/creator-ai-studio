---
name: cas-hermes-deploy-coolify
description: Safe deploy of Creator AI Studio to Coolify/VPS staging — validate branch/commit, run gates, use vps-redeploy.sh, verify api/web/worker/redis health. Use for staging redeploys only unless explicitly authorized for production.
---

# CAS Hermes Deploy (Coolify / VPS)

Deploy **staging** branch changes to the VPS Coolify stack safely.

## Preconditions

- Target branch: `staging` (not `main` unless promotion WO says otherwise)
- CI green on the commit to deploy
- Work Order authorizes deploy (no silent production changes)

## Pre-deploy gates (local or CI)

```bash
npm run typecheck
npm run test
npm run build
```

Record commit SHA; do not deploy uncommitted VPS-only changes.

## Staging stack

| Service | Role |
|---------|------|
| `api` | Fastify `/api/*`, episode storage |
| `web` | nginx + Vite static, proxies `/api` |
| `worker` | Production job runner |
| `redis` | Job queue |

Compose: `deploy/docker-compose.staging.yml`  
Public URL: `https://creator-ai-studio.217.76.56.66.sslip.io`

## VPS redeploy

On the VPS (as root or deploy user with docker access):

```bash
cd /root/creator-ai-studio   # or synced clone path
git fetch origin staging
git checkout staging
git pull origin staging
bash scripts/vps-redeploy.sh <short-commit-label>
```

Script: [scripts/vps-redeploy.sh](../../scripts/vps-redeploy.sh) — idempotent env injection, full service enumeration via `docker compose config --services`.

## Post-deploy verification

1. `GET /api/health` → success (no auth required).
2. Web UI loads; login works if Supabase auth enabled.
3. Confirm `api`, `web`, `worker`, `redis` running (script prints sanitized status only).
4. Optional: `node scripts/cas-hermes-val-staging.mjs` with `CAS_STAGING_TOKEN` (never log token).

## Rules

- Do **not** print `CAS_API_KEY`, service role keys, or `.env` contents.
- Do **not** modify Coolify project settings without explicit WO.
- Do **not** run IA pipeline or YouTube publish as part of deploy smoke unless WO says so.
- Rollback: redeploy previous Coolify deployment; episode data persists on volume.

## References

- [docs/01-architecture/DEPLOYMENT_STAGING.md](../../docs/01-architecture/DEPLOYMENT_STAGING.md)
- [docs/02-operations/RUNBOOK.md](../../docs/02-operations/RUNBOOK.md)
