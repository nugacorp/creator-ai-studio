## Document ID

PROJECT_STATE

## Title

Project State

## Version

0.4.0

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

Current phase: **Production Readiness** — Agent System v1.1 signed off; full pipeline chain validated locally.

Estimated completion: **~85%** toward production Definition of Done (code ~95%, production environment pending).

### Staging baseline

| Item | Value |
|------|-------|
| URL | https://creator-ai-studio.217.76.56.66.sslip.io |
| Branch | `staging` |
| Services | api, web, worker, redis |
| Auth | Supabase JWT + CAS_API_KEY worker |
| AI default | OpenAI (configured, billing active) |

### Completed (code)

- **Agent System v1.1** — 13 agentes (`hermes` + 12 especialistas)
  - Nuevos: `storyboard_designer`, `scene_asset_designer`
  - Prompts reforzados (doctrina, CTR YouTube, puertas de calidad)
  - API: `GET/POST /api/agents`, `GET/POST .../agent-runs`, `POST .../agents/:id/run`, `POST .../agent-runs/:id/approve`
  - Worker job type `agent`; persistencia `00-control/agent-runs.json`
  - UI `AgentsView` + panel **Producción del episodio** + badges de quality gates + aprobación humana
- **Pipeline E2E** — cadena agentes → jobs técnicos:
  - `narrator` → `tts`
  - `video_editor` → `render`
  - `seo_optimizer` → `publish_package`
  - Hermes `autoEnqueuePlan` encola agentes pendientes
- **CAS-HERMES-VAL** — checklist firmado + tests automatizados (`apps/api/test/agents.test.ts`) + script staging v1.1
- AI provider diagnostics + fallback (CAS-CURSOR-WO-0033)
- Security hardening (auth, rate limit, job claim)
- Safe pipeline API (`run-safe-pipeline`, `publish-package`)
- Worker pipeline modes (`buildPipelineStepKeys`)
- Mock policy (`ALLOW_MOCKS`, `config/mocks.ts`)
- Publish package builder (`10-publish/`)

### Validation status (2026-07-05)

| Area | Status |
|------|--------|
| OpenAI provider | ✅ smoke `CAS_TEST_OK` |
| Hermes orchestration | ✅ plan + agent jobs |
| Researcher → Scriptwriter → Storyboard → Assets | ✅ completed |
| Doctrine → TTS → Render → publish_package | ✅ enqueue chain (local CI) |
| UI refresh + production preview + quality gates | ✅ |
| Automated CAS-HERMES-VAL (CI) | ✅ 11+ tests |
| Formal Hermes sign-off | ✅ CAS-HERMES-VAL v1.1 |

### Blockers (operations)

1. **Production environment** — no separate Coolify app yet
2. **Domain** — still sslip.io
3. **Staging re-deploy** — push v1.1 to staging VPS and re-run `cas-hermes-val-staging.mjs`

### Next objectives

1. Deploy v1.1 to staging VPS and confirm remote CAS-HERMES-VAL PASS
2. E2E staging checklist (FASE 12) with real TTS + FFmpeg render
3. Production Coolify app + domain (FASE 10–11)

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
| 2026-07-05 | 0.4.0 | Cursor | v1.1 agents, pipeline E2E, CAS-HERMES-VAL sign-off |
