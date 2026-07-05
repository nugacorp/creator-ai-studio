# CAS-HERMES-VAL — Validate Agent System v1

**Work order ID:** CAS-HERMES-VAL  
**Owner:** Hermes (VPS) + Cursor  
**Scope:** Agent System v1 — API, worker, artifacts, stages (no full publish pipeline)

## Checklist

| # | Step | Pass criteria |
|---|------|----------------|
| 1 | `GET /api/agents` | `orchestrator: hermes`, ≥11 agents |
| 2 | Create or reuse test episode | Episode exists on staging disk |
| 3 | `POST .../agents/hermes/run` `async:false` `autoEnqueuePlan:false` | `200`, run `completed`, plan in output |
| 4 | `GET .../agent-runs` | Hermes run persisted |
| 5 | `POST .../agents/researcher/run` `async:false` | `200`, `01-research/notes.md` on disk |
| 6 | `POST .../agents/scriptwriter/run` `async:false` | `200`, `02-script/script.md`, script in content |
| 7 | Stages | `research` + `script` → `completed` |
| 8 | No accidental pipeline | Hermes without `autoEnqueuePlan` does not enqueue `tts`/`render`/`publish` jobs |
| 9 | IA failure | Agent run → `failed`/`blocked`, sanitized error (no API keys in response) |
| 10 | UI | AgentsView shows production panel after refresh |

## Automated (CI / local)

```bash
npm run test --workspace @creator-ai-studio/api -- agents.test.ts
```

Covers steps 1, 3–8 with `AI_ALLOW_DEMO_FALLBACK=true` (demo provider).

## Staging (manual / script)

```bash
# Requires Supabase JWT or CAS_API_KEY
export CAS_STAGING_URL=https://creator-ai-studio.217.76.56.66.sslip.io
export CAS_STAGING_TOKEN="<Bearer token>"
node scripts/cas-hermes-val-staging.mjs
```

Or from **Configuración → OpenAI → Probar** and **Agentes IA → Hermes: orquestar** in the web UI.

## Validation log — 2026-07-05

| Step | Staging | Local automated |
|------|---------|-----------------|
| 1 Agents list | ✅ (auth required) | ✅ |
| 2 Test episode | ✅ CAS WO 0026 | ✅ vitest temp |
| 3 Hermes sync | ✅ OpenAI plan completed | ✅ |
| 4 agent-runs | ✅ persisted | ✅ |
| 5 Researcher | ✅ completed (prior run) | ✅ |
| 6 Scriptwriter | ✅ script saved | ✅ |
| 7 Stages | ✅ research/script updated | ✅ |
| 8 No auto pipeline | ⚠️ `autoEnqueuePlan:true` encola agentes (by design) | ✅ tested false |
| 9 IA failure | ✅ prior runs show sanitized errors | ✅ demo fallback in tests |
| 10 UI panel | ✅ `be27018` production panel | N/A |

**Provider:** OpenAI (`aiProvider: openai`), billing active.

**Verdict:** Agent System v1 **functionally validated** on staging for research → script → thumbnail path.  
**Not yet signed:** full doctrine → TTS → render → publish chain; storyboard/assets agents (v1.1).

## Exit criteria (sign-off)

- [x] 11 agents registered
- [x] OpenAI provider working on staging
- [x] Hermes + researcher + scriptwriter produce artifacts
- [x] UI refresh + production preview
- [ ] Formal Hermes sign-off on CAS-HERMES-VAL
- [ ] v1.1: storyboard + scene assets + stronger prompts

## Related

- [AI_CREDENTIALS_CHECKLIST.md](AI_CREDENTIALS_CHECKLIST.md)
- [E2E_STAGING_CHECKLIST.md](E2E_STAGING_CHECKLIST.md)
- [PROJECT_STATE.md](../00-governance/PROJECT_STATE.md)
