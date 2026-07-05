# Creator AI Studio — Hermes Skills Index

**Version:** 1.0.0  
**Created:** 2026-07-05  
**Repo path:** `.hermes-skills/` (source of truth)  
**VPS install path:** `~/.hermes/skills/` (sync via `scripts/sync-hermes-skills.sh`)

## CAS local skills (versioned in repo)

| Skill | Use when |
|-------|----------|
| [cas-production-readiness](cas-production-readiness/SKILL.md) | Assessing readiness for real production (no mocks, real IA/TTS/render) |
| [cas-hermes-deploy-coolify](cas-hermes-deploy-coolify/SKILL.md) | Safe deploy to Coolify/VPS staging |
| [cas-ai-provider-validation](cas-ai-provider-validation/SKILL.md) | Validate OpenAI/Claude/Gemini real providers |
| [cas-e2e-safe-pipeline](cas-e2e-safe-pipeline/SKILL.md) | E2E pipeline through publish package (stop before YouTube) |
| [cas-security-validation](cas-security-validation/SKILL.md) | Auth, path traversal, rate limits, secret hygiene |
| [cas-ui-smoke-test](cas-ui-smoke-test/SKILL.md) | Dashboard/UI smoke without running IA pipeline |
| [cas-worker-redis-ops](cas-worker-redis-ops/SKILL.md) | Worker + Redis job queue operations |
| [cas-youtube-release-safety](cas-youtube-release-safety/SKILL.md) | YouTube upload with explicit authorization |
| [cas-supabase-auth-ops](cas-supabase-auth-ops/SKILL.md) | Supabase login, JWT, profile/settings |
| [cas-runbook-author](cas-runbook-author/SKILL.md) | CHANGELOG, RUNBOOK, deployment docs (no secret values) |

## Hub skills installed on VPS (not versioned here)

Official / trusted skills installed separately on the VPS Hermes instance:

- `official/devops/docker-management`
- `official/software-development/rest-graphql-debug`
- `official/security/web-pentest`
- `official/software-development/code-wiki`
- `official/dogfood/adversarial-ux-test`
- `skills-sh/openai/skills/playwright`

Do **not** overwrite Hub skills when syncing CAS skills from this repo.

## Bundled Hermes skills (reference)

Use existing builtins when appropriate: `github-pr-workflow`, `plan`, `test-driven-development`, `systematic-debugging`, `youtube-content`, `codebase-inspection`, `hermes-agent`.

## Sync to VPS

```bash
# From repo root on VPS (or after git pull)
bash scripts/sync-hermes-skills.sh          # apply
bash scripts/sync-hermes-skills.sh --dry-run # preview
```

After sync, start a new Hermes session or `/reset` so skills load into context.

## Global CAS security rules

- Never print API keys, OAuth tokens, `CAS_API_KEY`, JWTs, or `.env` contents.
- Never run YouTube publish without explicit human authorization.
- Never set `AI_ALLOW_DEMO_FALLBACK=true` on staging/production validation.
- Staging branch: `staging`. Production stable: `main` — do not deploy `main` changes without promotion process.
- Worker and Redis must be up before enqueueing production jobs.

## Risks / pending

- Hub skills `docker-management`, `rest-graphql-debug`, `web-pentest` document powerful commands — scope Work Orders narrowly.
- `playwright` is trusted (OpenAI via skills.sh) but not official — inspect before browser automation on production URLs.
- No `GITHUB_TOKEN` on VPS lowers Skills Hub rate limits (60 req/hr).

## Related repo docs

- [docs/02-operations/RUNBOOK.md](../docs/02-operations/RUNBOOK.md)
- [docs/01-architecture/DEPLOYMENT_STAGING.md](../docs/01-architecture/DEPLOYMENT_STAGING.md)
- [docs/02-operations/CAS-HERMES-VAL.md](../docs/02-operations/CAS-HERMES-VAL.md)
- [docs/02-operations/E2E_STAGING_CHECKLIST.md](../docs/02-operations/E2E_STAGING_CHECKLIST.md)
