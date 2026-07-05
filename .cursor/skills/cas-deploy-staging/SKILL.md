---
name: cas-deploy-staging
description: >-
  Deploys Creator AI Studio to staging via Coolify on VPS. Use when pushing
  staging branch, configuring env vars, rebuilding Docker, or troubleshooting
  staging API/worker/episodes volume.
---

# CAS Deploy Staging

## Flow

```
local staging branch → git push origin/staging → Coolify webhook/rebuild → VPS containers
```

Docs: `docs/01-architecture/DEPLOYMENT_STAGING.md`, `deploy/staging.env.example`

Staging URL: `https://creator-ai-studio.217.76.56.66.sslip.io`

## Build requirements

API and worker **do not hot-reload**. After code changes:

```bash
npm run build          # from repo root
# or workspace-specific build before start
```

Web is static assets served by nginx in Docker (`Dockerfile.web` + `deploy/nginx.web.conf`).

## Docker services

| Service | Notes |
|---------|-------|
| API | Fastify, port 3000 internally |
| Web | nginx serves SPA + proxies `/api/*` to API (same-origin) |
| Worker | Polls jobs, needs ffmpeg for render/shorts |

## Required environment variables

Set in Coolify (never commit secrets):

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini / Imagen AI |
| `ELEVENLABS_API_KEY` | TTS (or configure via Settings UI) |
| `SUPABASE_URL` | Auth + optional DB sync |
| `SUPABASE_ANON_KEY` | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side sync (protect) |
| `YOUTUBE_*` / OAuth | YouTube channel integration |
| `LOCAL_STORAGE_PATH` | **`/data/episodes`** on VPS (persistent volume) |
| `CAS_API_KEY` | Optional API key auth layer |

## Episode data on VPS

Mount persistent volume at **`/data/episodes`** for API and worker. Contains:

- Episode folders (`00-control` … `12-review`)
- `ideas.json` ideation store
- Jobs, settings persisted under same tree

**Do not** wipe volume on redeploy; verify in Coolify volume config.

## Pre-push checklist

```bash
npm run typecheck
npm run test
npm run build
git push origin staging
```

Monitor Coolify build logs; smoke UI after deploy (`cas-ui-smoke-test` in `.hermes-skills/` if available).

## Local dev vs staging

| | Local | Staging |
|---|-------|---------|
| API cwd episodes | `apps/api/episodes/` | `/data/episodes/` |
| Web/API origin | Cross-origin (CORS issues) | Same-origin via nginx |
| Auth | Optional (no keys) | Supabase JWT required |

## Rollback

Redeploy previous staging commit in Coolify or revert commit on `staging` and push again. Do not force-push `main` without explicit authorization.
