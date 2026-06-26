## Document ID

TECH_STACK

## Title

Technology Stack and Deployment Strategy

## Version

0.4.0

## Status

Draft

## Author

Claude Code

## Created

2026-06-25

## Last Updated

2026-06-25

## Purpose

Document the branching model, role responsibilities, and deployment strategy for Creator AI Studio.

## Scope

This document defines how code flows from development to production and which platforms and roles support that flow. It does not introduce or change any application functionality.

### Branching Model

Creator AI Studio uses a three-tier branching model:

| Branch | Environment | Purpose |
|---|---|---|
| `main` | Production | Stable, release-ready state. Always deployable. |
| `staging` | Testing / Integration | Validation and integration before promotion to production. |
| `feature/*` | Development | Isolated branches for individual development tasks. |

Promotion flow:

1. Development happens on `feature/*` branches.
2. Validated features are merged into `staging` for integration testing.
3. After validation in `staging`, changes are promoted to `main` (production).

### Roles

| Role | Responsibility |
|---|---|
| Claude Code | Develops on `feature/*` branches and prepares changes for validation. |
| Hermes | Validates, executes, and deploys to the VPS. |

- **Claude Code develops**: implements changes on `feature/*` branches.
- **Hermes validates, executes, and deploys** the validated changes on the VPS.

### Deployment Strategy

| Environment | Branch | Platform |
|---|---|---|
| Production | `main` | Stable production state on the VPS. |
| Staging | `staging` | Coolify (recommended) on the VPS. |

- **Coolify** is the recommended deployment platform for the `staging` environment, providing a self-hosted PaaS layer on the VPS for testing and integration.
- `main` represents the stable production state and is deployed only after validation in `staging`.

### Technology Stack

The executable MVP is an npm workspaces monorepo:

| Area | Technology | Location |
|---|---|---|
| Shared types | TypeScript | `packages/shared` |
| API | Fastify (Node.js, ESM) | `apps/api` |
| Web dashboard | React + Vite | `apps/web` |
| Production worker | Node.js (placeholder) | `workers/production` |
| Tests | Vitest | per workspace |
| Build / typecheck | TypeScript (`tsc`) + Vite | per workspace |

### Local Storage

The first functional flow persists episodes to the local filesystem; no external
services (OpenAI, Claude, ElevenLabs, YouTube) are called.

- Storage module: `apps/api/src/storage`.
- Root directory: `LOCAL_STORAGE_PATH` if set, otherwise `episodes/` (git-ignored).
- `POST /episodes` creates `episodes/<id>-<slug>/` with `episode.json`,
  `00-control/status.json`, `00-control/stages.json`, and stage folders
  `01-research` … `12-review` (each preserved with a `.gitkeep`).
- `GET /episodes/:id` returns the episode detail: summary metadata, the
  workspace path (relative to the storage root), and the production stages with
  their status (and expected files where applicable). Returns `404` if missing.

### Production Stages

Episodes progress through 15 ordered stages (`planning`, `research`, `script`,
`doctrine_review`, `editorial_review`, `storyboard`, `assets`, `audio`, `video`,
`thumbnail`, `seo`, `shorts`, `final_review`, `publishing`, `analytics`). Each
stage has a status (`pending`, `in_progress`, `completed`, `blocked`). On
creation, `planning` is `completed` and every other stage is `pending`. The
stage model lives in `packages/shared`; stage state is persisted per episode in
`00-control/stages.json`.

Stages are advanced manually (before real agents are connected) via
`PATCH /episodes/:id/stages/:stage` with a body of `{ "status": "..." }`. Simple
MVP transition rules (`canTransitionStage` in `packages/shared`) allow moving to
any other allowed status but reject a no-op transition to the current status.

### Operational Rules

- No force push to shared branches (`main`, `staging`).
- No deletion of shared branches.
- Secrets are never committed to the repository.

## Dependencies

DOCUMENTATION_STANDARD.md

## Related Documents

README.md, DOCUMENT_REGISTRY.md, PROJECT_REGISTRY.json

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Claude Code | Initial technology stack and deployment strategy document created. |
| 2026-06-25 | 0.2.0 | Claude Code | Documented MVP technology stack and local episode storage. |
| 2026-06-25 | 0.3.0 | Claude Code | Documented production stages model and GET /episodes/:id. |
| 2026-06-25 | 0.4.0 | Claude Code | Documented manual stage transitions (PATCH /episodes/:id/stages/:stage). |
