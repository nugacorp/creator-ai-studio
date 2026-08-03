## Document ID

PROJECT_STATE

## Title

Project State

## Version

1.0.0

## Status

Active — Production Readiness

## Author

Cursor + Hermes

## Created

2026-06-25

## Last Updated

2026-07-05 (RCLONE_REMOTE deploy sync)

## Staging HEAD

`staging` @ **`0cee3a4`** — `feat(archive): auto-evict published episodes to Google Drive when over VPS limit`

> **Canonical source of truth.** For historical snapshots and phase roadmaps, see linked docs below — they may lag behind `git log staging`. Prefer this file + recent commits when in doubt.

## Purpose

Maintain the official current state of Creator AI Studio.

## Scope

Current phase: **Production Readiness** — full agent pipeline, ideation workspace, multichannel, and staging deploy automated; production environment and E2E sign-off still pending.

Estimated completion: **~90%** toward production Definition of Done (code ~95%, ops/credentials/E2E pending).

### Staging baseline

| Item | Value |
|------|-------|
| URL | https://creator-ai-studio.217.76.56.66.sslip.io |
| Branch | `staging` @ `0cee3a4` |
| Services | api, web, worker, redis |
| Auth | Supabase JWT + `CAS_API_KEY` (worker / machine) |
| Storage | VPS volume `/data/episodes`; OAuth tokens on `/data` |
| Deploy | GitHub Actions → VPS (`deploy-staging.yml` on push to `staging`) |

### Modules (UI)

| Module | Route / surface | Status |
|--------|-----------------|--------|
| **Home** | Dashboard stats only | ✅ Live |
| **Contenido** | Sidebar → ideation workspace (raw idea → AI proposals → approve) | ✅ Live |
| **Proyectos** | Kanban + open episode workspace | ✅ Live |
| **Workspace** | Tabs per pipeline stage (Guion, storyboard, SEO, Shorts, etc.) | ✅ Live |
| **Multicanal** | YouTube channel list + active channel selection | ✅ Live |
| **Equipos** | Server-persisted roster | ✅ Live |
| **Agent Studio** | Overrides persisted in server settings | ✅ Live |
| **Modo Producción** | Real job queue API | ✅ Live |
| **Automatización** | Placeholder UI — **próximamente** (not wired to backend) | 🚧 MVP shell |
| **IA Copilot** | Free chat only | ✅ Live |

Channel scoping: workspace episodes and projects filter by **active YouTube channel** (`c1d1998`).

### Agent system (14 agents)

Hermes orchestrates: `hermes` → `researcher` → `scriptwriter` → `doctrine_reviewer` → `editorial_reviewer` → `storyboard_designer` → `scene_asset_designer` → `narrator` → `audio_engineer` → `thumbnail_designer` → `video_editor` → `seo_optimizer` → **`shorts_agent`** → `analytics_agent`

Registry: `apps/api/src/agents/registry.ts`. CAS-HERMES-VAL v1.1 signed off locally.

### Recent features (staging, Jul 2026)

| Feature | Commit (approx.) | Notes |
|---------|------------------|-------|
| **P0 Camino Bíblico** — shorts agent, SEO pinned comment, publish schedule | `ed6e61b` | API + worker |
| Shorts tab, schedule editor, SEO pinned comment UI | `ff4f01a`, `72a6cc4` | Web |
| **Ideation workspace** (Ideas/Contenido) | `2d4a5f1`, `a3f1b36` | AI proposals + approve |
| **Generate script** button on Guion tab | `b12e607` | Web |
| **Channel scoping** | `c1d1998` | Active YouTube channel |
| **YouTube OAuth persistence** on `/data` volume + auto-refresh | `1ceae26` | VPS-safe tokens |
| **Supabase web build-args** + `.env.supabase.local` VPS sync | `e478025`, `f454177` | Deploy/auth |
| **Google Drive archive (rclone)** — auto-evict when over `maxActiveEpisodes` | `0cee3a4` | Code merged; **`RCLONE_REMOTE` synced (GH secret + deploy); OAuth `rclone.conf` on VPS still required** |
| Google Lyria music integration | `1ba0237` | Optional provider |
| Calendar hybrid local + YouTube feed | `7ef242d` | |

### Deploy pipeline

1. **CI** (`.github/workflows/ci.yml`) — on push/PR to `main`, `staging`, `feature/**`: `npm ci` → typecheck → test → build.
2. **Deploy staging** (`.github/workflows/deploy-staging.yml`) — on push to `staging`: SSH to VPS, sync repo, run `scripts/vps-sync-supabase-env.sh` + `scripts/vps-redeploy.sh`.
3. **Web image build** requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` at build time (baked into static JS). Sourced from GitHub Actions secrets or `/root/creator-ai-studio/.env.supabase.local` on the VPS.
4. **Worker/API runtime** env from same `.env.supabase.local` + compose (`deploy/docker-compose.staging.yml`).

See [docs/02-operations/SUPABASE_AUTH.md](docs/02-operations/SUPABASE_AUTH.md) and [docs/01-architecture/DEPLOYMENT_STAGING.md](docs/01-architecture/DEPLOYMENT_STAGING.md).

### Known limitations

| Area | Limitation |
|------|------------|
| **Automatización** | UI shows workflow mockups; real automation engine not shipped — label **próximamente** |
| **Shorts** | MVP crop/package; not full reframing pipeline |
| **rclone / archive** | Code live; requires one-time `scripts/vps-setup-rclone.sh` (OAuth); `RCLONE_REMOTE` now synced from GitHub Actions |
| **Production** | No separate Coolify app; domain still sslip.io |
| **Local dev CORS** | If web calls API cross-origin (wrong `VITE_API_BASE_URL`), UI silently shows **demo data** — see [AGENTS.md](AGENTS.md) |
| **Metadata SoT** | Filesystem primary; Supabase sync write-only |

### CI status (local mirror, 2026-07-05)

| Gate | Status |
|------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run test` | ✅ Pass (all workspaces) |
| `npm run build` | ✅ Pass |
| GitHub Actions CI | Expected green on `staging` (same gates) |

Music tests pass without Lyria credentials (`dcb557a`).

### Blockers (operations)

1. **Production environment** — no separate Coolify app yet
2. **Domain** — still sslip.io
3. **rclone on VPS** � `RCLONE_REMOTE` synced; interactive OAuth (`vps-setup-rclone.sh`) still pending
4. **E2E staging** — full TTS + FFmpeg render sign-off pending

### Next objectives

1. Complete rclone one-time setup on VPS if archive auto-evict is needed
2. E2E staging checklist with real TTS + FFmpeg render
3. Production Coolify app + custom domain

### Related docs

| Doc | Role |
|-----|------|
| [AGENTS.md](AGENTS.md) | Cursor Cloud dev gotchas (CORS/proxy) |
| [docs/02-operations/STAGING_SNAPSHOT.md](docs/02-operations/STAGING_SNAPSHOT.md) | Historical staging snapshot |
| [docs/00-governance/ROADMAP.md](docs/00-governance/ROADMAP.md) | Phase roadmap (may lag) |
| [docs/02-operations/RCLONE_DRIVE.md](docs/02-operations/RCLONE_DRIVE.md) | Archive setup |
| [docs/02-operations/SUPABASE_AUTH.md](docs/02-operations/SUPABASE_AUTH.md) | Auth + deploy env |
| [docs/02-operations/CAS-HERMES-VAL.md](docs/02-operations/CAS-HERMES-VAL.md) | Agent validation |
| [docs/02-operations/E2E_STAGING_CHECKLIST.md](docs/02-operations/E2E_STAGING_CHECKLIST.md) | Staging E2E |

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial project state |
| 2026-07-05 | 0.2.0 | Cursor | Production Readiness baseline snapshot |
| 2026-07-05 | 0.3.0 | Cursor | Agent System v1 + CAS-HERMES-VAL |
| 2026-07-05 | 0.4.0 | Cursor | v1.1 agents, pipeline E2E |
| 2026-07-05 | 1.0.0 | Cursor | Sync with staging `0cee3a4`: 14 agents, Contenido, channels, rclone, deploy env |
