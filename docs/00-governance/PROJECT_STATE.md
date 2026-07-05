## Document ID

PROJECT_STATE

## Title

Project State

## Version

0.3.0

## Status

Active — Production Readiness

## Author

Cursor + Hermes

## Created

2026-06-25

## Last Updated

2026-07-05

## Purpose

Maintain the official current state of Creator AI Studio.

## Scope

Current phase: **Production Readiness** — Agent System v1 on staging, E2E validation in progress.

Estimated completion: **~75%** toward production Definition of Done (code ~90%, full pipeline sign-off pending).

### Staging baseline

| Item | Value |
|------|-------|
| URL | https://creator-ai-studio.217.76.56.66.sslip.io |
| Branch | `staging` @ `be27018`+ |
| Services | api, web, worker, redis |
| Auth | Supabase JWT + CAS_API_KEY worker |
| AI default | OpenAI (configured, billing active) |

### Completed (code)

- **Agent System v1** — 11 agentes (`hermes` + 10 especialistas)
  - API: `GET/POST /api/agents`, `GET/POST .../agent-runs`, `POST .../agents/:id/run`
  - Worker job type `agent`; persistencia `00-control/agent-runs.json`
  - UI `AgentsView` + panel **Producción del episodio** (guion, miniatura, audio, video)
- **CAS-HERMES-VAL** — checklist + tests automatizados (`apps/api/test/agents.test.ts`)
- AI provider diagnostics + fallback (CAS-CURSOR-WO-0033)
- Security hardening (auth, rate limit, job claim)
- Safe pipeline API (`run-safe-pipeline`, `publish-package`)
- Worker pipeline modes (`buildPipelineStepKeys`)
- Mock policy (`ALLOW_MOCKS`, `config/mocks.ts`)
- Publish package builder (`10-publish/`)

### Staging validation (2026-07-05)

| Area | Status |
|------|--------|
| OpenAI provider | ✅ smoke `CAS_TEST_OK` |
| Hermes orchestration | ✅ plan + agent jobs on CAS WO 0026 |
| Researcher → Scriptwriter → Thumbnail | ✅ completed |
| UI refresh + production preview | ✅ `be27018` |
| Automated CAS-HERMES-VAL (CI) | ✅ 6 tests |
| Formal Hermes sign-off | ⏳ pending |

### Blockers (operations)

1. **Full pipeline E2E** — doctrine → TTS → render → publish not yet signed off
2. **v1.1 agents** — storyboard + scene assets not implemented
3. **Production environment** — no separate Coolify app yet
4. **Domain** — still sslip.io

### Next objectives

1. Hermes: sign-off [CAS-HERMES-VAL.md](docs/02-operations/CAS-HERMES-VAL.md)
2. Agent System v1.1 — storyboard_designer, scene_asset_designer, stronger prompts
3. E2E staging checklist (FASE 12)
4. Production Coolify app + domain (FASE 10–11)

### Related docs

- [CAS-HERMES-VAL.md](docs/02-operations/CAS-HERMES-VAL.md)
- [STAGING_SNAPSHOT.md](docs/02-operations/STAGING_SNAPSHOT.md)
- [AI_CREDENTIALS_CHECKLIST.md](docs/02-operations/AI_CREDENTIALS_CHECKLIST.md)
- [E2E_STAGING_CHECKLIST.md](docs/02-operations/E2E_STAGING_CHECKLIST.md)
- [PRODUCTION_PROMOTION.md](docs/02-operations/PRODUCTION_PROMOTION.md)

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial project state |
| 2026-07-05 | 0.2.0 | Cursor | Production Readiness baseline snapshot |
| 2026-07-05 | 0.3.0 | Cursor | Agent System v1 + CAS-HERMES-VAL documented |
