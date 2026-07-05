---
name: cas-e2e-safe-pipeline
description: Run Creator AI Studio E2E production pipeline safely through publish package — SEO, TTS, thumbnail, render, shorts — stopping before YouTube publish. Use for staging validation Work Orders.
---

# CAS E2E Safe Pipeline

Execute the **full production pipeline** on a test episode through **publish package** generation. **Stop before YouTube upload** unless a separate WO authorizes `cas-youtube-release-safety`.

## Scope

Includes: research/script (optional), SEO, TTS/narration, thumbnail, FFmpeg render, shorts, publish package assembly.  
Excludes: `confirm-publish`, YouTube OAuth upload, public visibility changes.

## Preconditions

- Worker + Redis up ([cas-worker-redis-ops](../cas-worker-redis-ops/SKILL.md))
- Real AI provider ([cas-ai-provider-validation](../cas-ai-provider-validation/SKILL.md))
- TTS configured (ElevenLabs or Piper)
- Test episode ID documented in WO

## Paths

**Agent System v1.1** (preferred):

1. `POST /api/episodes/:id/agents/hermes/run` with `autoEnqueuePlan: true` (async via worker) OR step through agents manually.
2. Approve human gates: `doctrine_reviewer`, `editorial_reviewer` via UI or `POST .../agent-runs/:runId/approve`.
3. Verify enqueue chain: `tts` → `render` → `publish_package` jobs in `/api/jobs`.

**Legacy safe pipeline**:

- `POST /api/episodes/:id/run-safe-pipeline` or `scripts/local-e2e-pipeline.mjs` (local only with WO permission).

## Artifact checks (on disk under episode workspace)

| Stage | Expected |
|-------|----------|
| Script | `02-script/script.md` or content API |
| Audio | narration file / `audioUrl` |
| Thumbnail | image in `06-thumbnail/` or content |
| Video | rendered mp4 |
| Publish package | bundle ready, not uploaded |

## Staging script

```bash
# Requires CAS_STAGING_TOKEN — never echo it
node scripts/cas-hermes-val-staging.mjs
```

## Stop conditions

- Any job `failed` → capture sanitized error, do not retry publish.
- YouTube upload requested → halt; escalate to `cas-youtube-release-safety` with explicit authorization.

## References

- [docs/02-operations/CAS-HERMES-VAL.md](../../docs/02-operations/CAS-HERMES-VAL.md)
- [docs/02-operations/E2E_STAGING_CHECKLIST.md](../../docs/02-operations/E2E_STAGING_CHECKLIST.md)
- [docs/02-operations/E2E_LOCAL_FINDINGS.md](../../docs/02-operations/E2E_LOCAL_FINDINGS.md)
