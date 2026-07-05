## Document ID

PROJECT_STATE

## Title

Project State

## Version

0.2.0

## Status

Active — Production Readiness

## Author

Cursor + Hermes

## Created

2026-06-25

## Last Updated

2026-07-04

## Purpose

Maintain the official current state of Creator AI Studio.

## Scope

Current phase: **Production Readiness** — staging functional, production gates in progress.

Estimated completion: **~70%** toward production Definition of Done (code ~85%, credentials/E2E pending).

### Staging baseline

| Item | Value |
|------|-------|
| URL | https://creator-ai-studio.217.76.56.66.sslip.io |
| Branch | `staging` @ `7cce96a` |
| Services | api, web, worker, redis |
| Auth | Supabase JWT + CAS_API_KEY worker |

### Completed (code)

- **Agent System v1** — Hermes orquestador + 10 especialistas (`apps/api/src/agents/`)
  - Endpoints: `GET /api/agents`, `POST /api/episodes/:id/agents/:agentId/run`, `GET .../agent-runs`
  - Job type `agent` en worker; UI `AgentsView` consume API real
  - Persistencia en `{episode}/00-control/agent-runs.json`
- AI provider diagnostics + fallback (CAS-CURSOR-WO-0033)
- Security hardening (auth, rate limit, job claim)
- Safe pipeline API (`run-safe-pipeline`, `publish-package`)
- Worker pipeline modes (`buildPipelineStepKeys`)
- Mock policy (`ALLOW_MOCKS`, `config/mocks.ts`)
- Publish package builder (`10-publish/`)

### Blockers (operations)

1. **IA providers** — billing/credentials (Gemini OAuth, OpenAI quota, Claude balance)
2. **E2E staging** — not yet signed off by Hermes
3. **Production environment** — no separate Coolify app yet
4. **Domain** — still sslip.io

### Next objectives

1. PO: activate IA provider billing (FASE 1)
2. Hermes: E2E staging checklist (FASE 12)
3. Merge `feature/production-readiness` → `staging`
4. Production Coolify app + domain (FASE 10–11)

### Related docs

- [STAGING_SNAPSHOT.md](docs/02-operations/STAGING_SNAPSHOT.md)
- [AI_CREDENTIALS_CHECKLIST.md](docs/02-operations/AI_CREDENTIALS_CHECKLIST.md)
- [E2E_STAGING_CHECKLIST.md](docs/02-operations/E2E_STAGING_CHECKLIST.md)
- [PRODUCTION_PROMOTION.md](docs/02-operations/PRODUCTION_PROMOTION.md)

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial project state |
| 2026-07-05 | 0.2.0 | Cursor | Production Readiness baseline snapshot |
