# AGENTS.md

## Cursor Cloud specific instructions

Creator AI Studio is an npm workspaces monorepo (Node >= 20). Standard commands are
documented in `README.md`; the notes below only cover non-obvious startup/run caveats
for this environment. The update script already runs `npm install` on VM startup.

### Services

| Service | Location | Run (dev) | Notes |
|---|---|---|---|
| API | `apps/api` (`@creator-ai-studio/api`) | `npm run start --workspace @creator-ai-studio/api` | Fastify on port `3000`. Runs `node dist/server.js`, so it must be **built first** (`npm run build` from root, or the workspace `build` script). No watch/hot-reload — rebuild after code changes. Runs without auth in dev (no `CAS_API_KEY`/`SUPABASE_*`). |
| Web | `apps/web` (`@creator-ai-studio/web`) | `npm run dev --workspace @creator-ai-studio/web` | Vite dev server on port `5173` with HMR. |
| Worker | `workers/production` (`@creator-ai-studio/production-worker`) | `npm run start --workspace @creator-ai-studio/production-worker` | Polls the API `/jobs/pending` every 5s. Must be **built first** (no watch). No Redis required (falls back to polling). |

### Non-obvious gotchas

- **Frontend↔backend is cross-origin in the default dev setup.** The web dev server
  (`5173`) and API (`3000`) are different origins. The API has **no CORS plugin** and
  Vite has **no dev proxy**, so the dashboard's real API calls are blocked by CORS and
  the UI silently falls back to built-in **demo data** (e.g. sample "David vs Goliat"
  projects appear even when the backend has none). In production this is solved by an
  nginx same-origin setup (`Dockerfile.web` + `deploy/nginx.web.conf`, serving the app
  and proxying `/api`). To exercise the dashboard against the real backend locally, put
  both on a single origin (any reverse proxy that serves the web app and forwards
  `/api/*` to the API on `3000`). The dashboard reads `VITE_API_BASE_URL` (defaults to
  `/api`).
- **Episode storage location.** Episodes persist to the local filesystem at
  `LOCAL_STORAGE_PATH` (default `episodes/`, resolved relative to the process cwd). When
  the API is started via the workspace `start` script, its cwd is `apps/api`, so data
  lands in `apps/api/episodes/` (git-ignored).
- **`maxActiveEpisodes` defaults to 1.** Creating a second active episode returns HTTP
  `409` until the first is archived/published. Adjust via `PATCH /api/settings`.
- **Worker render/pipeline jobs need extras.** `render`/`shorts`/`pipeline` jobs require
  `ffmpeg` and AI/integration keys; without them those jobs fail gracefully while the
  worker itself keeps polling/claiming normally.

### Quality gates

Run from the repo root (mirrors CI in `.github/workflows/ci.yml`): `npm run typecheck`,
`npm run test`, `npm run build`. There is no lint script.
