---
name: creator-ai-studio
description: >-
  Guides development of Creator AI Studio npm monorepo (API, web, worker, shared).
  Use when editing CAS code, agents, episodes, dashboard UI, staging deploy, or
  when the user mentions Creator AI Studio, Camino Bíblico, or Hermes.
---

# Creator AI Studio

## Monorepo layout

| Path | Package | Dev command |
|------|---------|-------------|
| `apps/api` | `@creator-ai-studio/api` | `npm run start --workspace @creator-ai-studio/api` (port 3000, **build first**) |
| `apps/web` | `@creator-ai-studio/web` | `npm run dev --workspace @creator-ai-studio/web` (port 5173, HMR) |
| `workers/production` | `@creator-ai-studio/production-worker` | `npm run start --workspace @creator-ai-studio/production-worker` (polls `/jobs/pending`) |
| `packages/shared` | `@creator-ai-studio/shared` | types/constants shared by API, web, worker |

Branch: **`staging`** → push to `origin/staging` → Coolify rebuild on VPS (Docker).

## Episode folder structure

Each episode on disk (`LOCAL_STORAGE_PATH`, default `apps/api/episodes/` locally, `/data/episodes` on VPS):

```
00-control/     status.json, stages.json, content.json
01-research/    brief.md, sources
02-script/      script.md
03-storyboard/  scenes
04-assets/      scene images
05-audio/       narration, music
06-video/       render output
06-subtitles/   SRT
07-thumbnail/   thumbnail assets
08-seo/         metadata
09-shorts/      shorts package
10-publish/     publish bundle
11-analytics/   post-publish metrics
12-review/      final review notes
```

## 14 agents (Hermes orchestrates)

`hermes` → `researcher` → `scriptwriter` → `doctrine_reviewer` → `editorial_reviewer` → `storyboard_designer` → `scene_asset_designer` → `narrator` → `audio_engineer` → `thumbnail_designer` → `video_editor` → `seo_optimizer` → `shorts_agent` → `analytics_agent`

Registry: `apps/api/src/agents/registry.ts`. Runner: `apps/api/src/agents/runner.ts`.

## UI duplication rule (audit)

**Do not duplicate modules.** One surface per workflow:

- **Home**: dashboard stats only; no fake modals for unimplemented flows
- **Contenido** (sidebar): ideation workspace (raw idea → AI proposals → approve)
- **Proyectos**: Kanban board; open workspace from here
- **Workspace tabs**: one tab per pipeline stage (script, storyboard, SEO, shorts, etc.)
- **Automatización**: show "próximamente" until real automation ships
- **IA Copilot**: free chat only; not a duplicate ideation or workspace

## Auth and media URLs

- Production auth: Supabase JWT (`Authorization: Bearer`) + optional `CAS_API_KEY`
- Canonical media URLs: `/api/episodes/{id}/files/{type}` (audio, video, thumbnail, subtitles, music, shorts)
- Dev CORS: web `:5173` and API `:3000` are cross-origin; use same-origin proxy or expect demo fallback

## Quality gates (before push)

From repo root:

```bash
npm run typecheck
npm run test
npm run build
```

## Key settings

- `maxActiveEpisodes` defaults to **1** (409 if exceeded)
- Episode data persists under `LOCAL_STORAGE_PATH` relative to API cwd
