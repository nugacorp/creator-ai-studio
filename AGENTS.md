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

#### Local dev: same-origin API (avoid silent demo data)

The dashboard calls the API via `VITE_API_BASE_URL` (default **`/api`**). In production, nginx serves the SPA and proxies `/api` → the API container (same origin).

**Local default (recommended):** `apps/web/vite.config.ts` defines a Vite dev proxy — `/api` → `http://127.0.0.1:3000`. With the default env, the browser talks to `http://localhost:5173/api/...` (same origin as the dev server); Vite forwards to the API.

```bash
# Terminal 1 — build once, then start API on :3000
npm run build --workspace @creator-ai-studio/api
npm run start --workspace @creator-ai-studio/api

# Terminal 2 — Vite on :5173 (proxy active)
npm run dev --workspace @creator-ai-studio/web
```

Keep **`VITE_API_BASE_URL=/api`** (or unset — same default). Do **not** point it at `http://localhost:3000/api` unless you also add CORS on the API.

**Symptoms when misconfigured (cross-origin):** API requests fail (no CORS plugin on Fastify). The UI **silently falls back to built-in demo data** — e.g. sample "David vs Goliat" projects, fake Analytics KPIs, placeholder channels, empty real backend despite API running.

**Fix checklist:**

1. Open the app at **`http://localhost:5173`** (not `:3000`).
2. Ensure `.env` / `.env.local` does **not** override `VITE_API_BASE_URL` to a full `http://localhost:3000/...` URL.
3. Confirm `apps/web/vite.config.ts` proxy block is present (do not remove for local dev).
4. Rebuild/restart web dev server after env changes (Vite inlines `VITE_*` at startup).
5. Optional sanity check: Network tab should show requests to `/api/...` on port **5173**, not direct `:3000` calls.

Alternative: any reverse proxy that serves the web app and forwards `/api/*` to port `3000` on one origin.

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
