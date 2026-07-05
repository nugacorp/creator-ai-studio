---
name: cas-production-readiness
description: Assess Creator AI Studio production readiness — real auth, real AI/TTS/render, worker/Redis, no demo mode. Use before promoting staging to production or signing off a release.
---

# CAS Production Readiness

Evaluate whether Creator AI Studio is ready for **real production**, not demo or mock operation.

## When to use

- Before production Coolify app or custom domain go-live
- After major pipeline or auth changes
- When Hermes or Cursor needs a structured readiness gate

## Hard requirements (must pass)

| Area | Check |
|------|-------|
| Auth | Supabase login required when `authRequired`; protected routes return 401 without token |
| AI | `demoMode=false`, `AI_ALLOW_DEMO_FALLBACK=false` on target environment |
| Providers | At least one real provider (OpenAI/Gemini/Claude) passes smoke via Settings or `/api/ai/providers/status` |
| TTS | ElevenLabs or Piper configured; narration job produces real audio file on disk |
| Render | FFmpeg render produces video artifact under episode workspace |
| Worker | `worker` + `redis` containers running; jobs move pending → active → completed |
| Storage | `LOCAL_STORAGE_PATH` on persistent volume; episodes survive redeploy |
| YouTube | OAuth configured; publish only via explicit `authorized: true` gate |
| Secrets | `CAS_SECRETS_KEY` set; no keys in logs or API error responses |
| HTTPS | Production domain with valid TLS for OAuth |

## Explicitly reject

- Mock agents or fake pipeline success without disk artifacts
- Demo mode fallback masking provider failures
- Publishing to YouTube without written authorization
- Deploying from `main` without promotion checklist

## Procedure

1. Read [docs/00-governance/PROJECT_STATE.md](../../docs/00-governance/PROJECT_STATE.md) and [docs/02-operations/PRODUCTION_PROMOTION.md](../../docs/02-operations/PRODUCTION_PROMOTION.md).
2. Run `npm run test`, `npm run typecheck`, `npm run build` on the commit to deploy.
3. On staging: `curl -sS "$CAS_PUBLIC_URL/api/health"` → `ok`.
4. Validate auth, AI, worker (use sibling skills: `cas-ai-provider-validation`, `cas-worker-redis-ops`, `cas-security-validation`).
5. Document gaps in runbook — **never paste secret values**.

## Output

Structured checklist: pass/fail per area, blockers, recommended next Work Order.
