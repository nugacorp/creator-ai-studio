# Staging Snapshot — Production Readiness (FASE 0)

> ⚠️ **Snapshot histórico — ver [PROJECT_STATE.md](../../PROJECT_STATE.md) para el estado actual.** Los commits y features listados abajo corresponden a un punto anterior de `staging`.

**Captured:** 2026-07-05  
**Work order:** Production Readiness Master Plan

## Git

| Branch | Commit | Notes |
|--------|--------|-------|
| `staging` | `7cce96a` | Merge PR #7 workspace navigation |
| `main` | `105c68e` | Promoted via PR #6 (Jul 2026) |
| Active dev | `feature/production-readiness` | This implementation branch |

## Staging URL

https://creator-ai-studio.217.76.56.66.sslip.io

## Services (expected)

| Service | Role |
|---------|------|
| `api` | Fastify API, port 3000 internal |
| `web` | Nginx SPA |
| `worker` | Production pipeline worker |
| `redis` | BullMQ job queue |

## Non-secret environment (staging)

```env
NODE_ENV=production
CAS_PUBLIC_URL=https://creator-ai-studio.217.76.56.66.sslip.io
ALLOW_MOCKS=false
AI_ALLOW_DEMO_FALLBACK=false
AI_FALLBACK_ENABLED=true
REDIS_URL=redis://redis:6379
LOCAL_STORAGE_PATH=/data/episodes
```

## Health checks

```http
GET /api/health
GET /api/system/mode
GET /api/ai/providers/status
```

## Auth

- Supabase JWT + `CAS_API_KEY` for worker
- Protected routes return 401 without credentials
- Public: `/health`, `/oauth/*`

## Known issues (pre-production-readiness)

1. **IA providers** — Gemini OAuth scopes, OpenAI quota, Claude balance (billing/credentials, not code)
2. **Analytics** — fake KPIs when OAuth missing (fixed in FASE 8 when `ALLOW_MOCKS=false`)
3. **Pipeline UI** — legacy button called full pipeline including YouTube (fixed in FASE 3 UI)
4. **No production Coolify app** — staging only (FASE 11)
5. **Metadata SoT** — filesystem; Supabase sync write-only (FASE 9)

## Hermes verification checklist

- [ ] `docker ps` shows api, web, worker, redis healthy
- [ ] Last GH Actions deploy success on `staging`
- [ ] Login UI works (Supabase)
- [ ] Episodes load for authenticated user
- [ ] `GET /api/episodes` without auth → 401
- [ ] PR #7 workspace navigation deployed
