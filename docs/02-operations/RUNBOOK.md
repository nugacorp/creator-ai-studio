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

1. Push validated changes to the `staging` branch.
2. In Coolify, trigger redeploy of the CAS stack.
3. Verify health: `curl https://your-domain/api/health`
4. Smoke test: create episode → edit script → generate with AI copilot.

## Environment Variables (Required for Full Functionality)

| Variable | Purpose |
|---|---|
| `LOCAL_STORAGE_PATH` | Episode filesystem storage (mount persistent volume) |
| `GEMINI_API_KEY` | Primary AI provider (or OpenAI/Anthropic) |
| `CAS_API_KEY` | Optional API authentication |

## Rollback

1. In Coolify, redeploy the previous successful deployment.
2. Episode data persists in the mounted volume at `LOCAL_STORAGE_PATH`.

## Rotate API Keys

1. Update keys in Coolify environment variables.
2. Redeploy API container (no code change needed).
3. Verify `/api/ai/usage` logs show the new provider responding.

## Enable Worker

```bash
docker compose -f docker-compose.staging.yml --profile worker up -d
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
