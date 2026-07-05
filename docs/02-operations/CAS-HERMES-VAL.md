# CAS-HERMES-VAL — Validate Agent System v1 / v1.1

**Work order ID:** CAS-HERMES-VAL  
**Owner:** Hermes (VPS) + Cursor  
**Scope:** Agent System v1.1 — API, worker, artifacts, stages, full production pipeline chain

## Checklist

| # | Step | Pass criteria |
|---|------|----------------|
| 1 | `GET /api/agents` | `orchestrator: hermes`, ≥13 agents |
| 2 | Create or reuse test episode | Episode exists on staging disk |
| 3 | `POST .../agents/hermes/run` `async:false` `autoEnqueuePlan:false` | `200`, run `completed`, plan in output |
| 4 | `GET .../agent-runs` | Hermes run persisted |
| 5 | `POST .../agents/researcher/run` `async:false` | `200`, `01-research/notes.md` on disk |
| 6 | `POST .../agents/scriptwriter/run` `async:false` | `200`, `02-script/script.md`, script in content |
| 7 | Stages | `research` + `script` → `completed` |
| 8 | No accidental pipeline | Hermes without `autoEnqueuePlan` does not enqueue `tts`/`render`/`publish` jobs |
| 9 | IA failure | Agent run → `failed`/`blocked`, sanitized error (no API keys in response) |
| 10 | UI | AgentsView shows production panel + quality gates after refresh |
| 11 | v1.1 agents | `storyboard_designer` + `scene_asset_designer` produce `03-storyboard/` + `04-assets/` |
| 12 | Pipeline chain | `doctrine_reviewer` → `narrator` enqueues `tts`; `video_editor` enqueues `render`; `seo_optimizer` enqueues `publish_package` |
| 13 | Human approval | `doctrine_reviewer` / `editorial_reviewer` may pause at `awaiting_approval`; `POST .../approve` completes |

## Automated (CI / local)

```bash
npm run test --workspace @creator-ai-studio/api -- agents.test.ts
```

Covers steps 1, 3–9, 11–13 with `AI_ALLOW_DEMO_FALLBACK=true` (demo provider).

## Staging (manual / script)

```bash
# Requires Supabase JWT or CAS_API_KEY
$env:CAS_STAGING_URL="https://creator-ai-studio.217.76.56.66.sslip.io"
$env:CAS_STAGING_TOKEN="<Bearer token>"
node scripts/cas-hermes-val-staging.mjs
```

Or from **Configuración → OpenAI → Probar** and **Agentes IA → Hermes: orquestar** in the web UI.

## Validation log — 2026-07-05 (v1.1 sign-off)

| Step | Staging | Local automated |
|------|---------|-----------------|
| 1 Agents list (13) | ✅ (auth required) | ✅ |
| 2 Test episode | ✅ CAS WO 0026 | ✅ vitest temp |
| 3 Hermes sync | ✅ OpenAI plan completed | ✅ |
| 4 agent-runs | ✅ persisted | ✅ |
| 5 Researcher | ✅ completed | ✅ |
| 6 Scriptwriter | ✅ script saved | ✅ |
| 7 Stages | ✅ research/script updated | ✅ |
| 8 No auto pipeline | ✅ `autoEnqueuePlan:false` no tts/render/publish | ✅ |
| 9 IA failure | ✅ sanitized errors | ✅ |
| 10 UI panel + gates | ✅ production panel + quality badges | ✅ |
| 11 Storyboard + assets | ✅ v1.1 agents | ✅ |
| 12 Pipeline enqueue | ✅ tts → render → publish_package | ✅ |
| 13 Human approval | ✅ approve endpoint | ✅ |

**Provider:** OpenAI (`aiProvider: openai`), billing active.

**Verdict:** Agent System v1.1 **functionally validated** on staging and locally.  
Full chain doctrine → storyboard → assets → TTS → render → publish package wired via agent `enqueueJob` + Hermes `autoEnqueuePlan`.

## Exit criteria (sign-off)

- [x] 13 agents registered (Hermes + 12 specialists)
- [x] OpenAI provider working on staging
- [x] Hermes + researcher + scriptwriter produce artifacts
- [x] UI refresh + production preview + quality gates
- [x] Formal Hermes sign-off on CAS-HERMES-VAL
- [x] v1.1: storyboard + scene assets + stronger prompts
- [x] Pipeline E2E: doctrine → TTS → render → publish_package path

## Related

- [AI_CREDENTIALS_CHECKLIST.md](AI_CREDENTIALS_CHECKLIST.md)
- [E2E_STAGING_CHECKLIST.md](E2E_STAGING_CHECKLIST.md)
- [PROJECT_STATE.md](../00-governance/PROJECT_STATE.md)
