## Document ID

README

## Title

Creator AI Studio Repository Entry Point

## Version

0.7.0

## Status

Draft

## Author

Hermes

## Created

2026-06-25

## Last Updated

2026-06-25

## Purpose

Provide the initial repository entry point for Creator AI Studio during Phase 0: Blueprint.

## Scope

This repository contains the CAS OS documentation infrastructure and the executable MVP (an npm workspaces monorepo: `apps/api`, `apps/web`, `workers/production`, `packages/shared`).

Official entry points:

- [MASTER_INDEX.md](MASTER_INDEX.md)
- [PROJECT_STATE.md](PROJECT_STATE.md)
- [ROADMAP.md](ROADMAP.md)
- [CHANGELOG.md](CHANGELOG.md)
- [DOCUMENT_REGISTRY.md](DOCUMENT_REGISTRY.md)
- [PROJECT_REGISTRY.json](PROJECT_REGISTRY.json)

### Branching and Deployment Strategy

Creator AI Studio uses a three-tier branching model. No functionality is changed by adopting this model; it only governs how work flows from development to production.

| Branch | Environment | Purpose |
|---|---|---|
| `main` | Production | Stable, release-ready state. Always deployable. |
| `staging` | Testing / Integration | Validation and integration before promotion to production. |
| `feature/*` | Development | Isolated branches for individual development tasks. |

Work flow:

1. Development happens on `feature/*` branches.
2. Validated features are integrated into `staging` for testing.
3. After validation in `staging`, changes are promoted to `main` (production).

Roles:

- **Claude Code** develops on `feature/*` branches and prepares changes.
- **Hermes** validates, executes, and deploys to the VPS.

Deployment:

- **Coolify** is the recommended deployment platform for the `staging` environment on the VPS.
- `main` represents the stable production state.

Operational rules:

- No force push to shared branches (`main`, `staging`).
- No deletion of shared branches.
- Secrets are never committed to the repository.

For the full rationale and platform details, see [docs/01-architecture/TECH_STACK.md](docs/01-architecture/TECH_STACK.md).

### Local Development

Requirements: Node.js >= 20 and npm.

Install dependencies (from the repository root):

```bash
npm install
```

If `npm install` fails behind a corporate proxy with a TLS error such as
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, make Node use the system certificate store:

```bash
NODE_OPTIONS=--use-system-ca npm install
```

Run the API (Fastify, defaults to `http://localhost:3000`):

```bash
npm run start --workspace @creator-ai-studio/api
```

Endpoints are available under `/api` for same-origin staging traffic and remain
available without the prefix for local/backward compatibility:

- `GET /api/health` and `GET /health` — service status.
- `GET /api/episodes` and `GET /episodes` — list episodes.
- `POST /api/episodes` and `POST /episodes` — create an episode (body `{ "title": "..." }`).
- `GET /api/episodes/:id` and `GET /episodes/:id` — episode detail (metadata, workspace path and stages); `404` if not found.
- `PATCH /api/episodes/:id/stages/:stage` and `PATCH /episodes/:id/stages/:stage` — update a stage's status (body `{ "status": "in_progress" }`); `404` if the episode is missing, `400` if the stage or status is invalid.

Run the web dashboard (Vite dev server, defaults to `http://localhost:5173`):

```bash
npm run dev --workspace @creator-ai-studio/web
```

By default the dashboard calls the same-origin API base path `/api`. Set
`VITE_API_BASE_URL` (see [.env.example](.env.example)) only when a local or
non-staging environment needs to override that base URL.

The dashboard's visual design (dark "Creator OS" theme, sidebar/header layout,
cards and navigation) was integrated from the Google AI Studio UI/UX reference
([nugacorp/Creator-AI-Studio-ui-ux](https://github.com/nugacorp/Creator-AI-Studio-ui-ux))
as a visual reference only. Its Gemini server, secrets and mock data were **not**
imported — the dashboard talks exclusively to the local API above. Styling uses
Tailwind CSS v4 and `lucide-react` icons.

Run the production worker (placeholder):

```bash
npm run start --workspace @creator-ai-studio/production-worker
```

Quality gates (run from the root):

```bash
npm run test
npm run typecheck
npm run build
```

Episodes are stored on the local filesystem under `LOCAL_STORAGE_PATH` (default
`episodes/`, which is git-ignored). No external services are called.

## Dependencies

None

## Related Documents

MASTER_INDEX.md, PROJECT_STATE.md, docs/01-architecture/TECH_STACK.md

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial repository entry point created. |
| 2026-06-25 | 0.1.0 | Hermes | Normalized document to official documentation standard. |
| 2026-06-25 | 0.2.0 | Claude Code | Added branching and deployment strategy (main / staging / feature). |
| 2026-06-25 | 0.3.0 | Claude Code | Added Local Development instructions (install, API, web, worker, CA note). |
| 2026-06-25 | 0.4.0 | Claude Code | Documented GET /episodes/:id (episode detail with stages). |
| 2026-06-25 | 0.5.0 | Claude Code | Documented PATCH /episodes/:id/stages/:stage (manual stage transitions). |
| 2026-06-25 | 0.6.0 | Claude Code | Integrated Google AI Studio UI/UX dashboard design (Tailwind v4, sidebar/header layout). |
| 2026-06-25 | 0.7.0 | Hermes | Documented same-origin `/api` dashboard/API routing for staging. |
