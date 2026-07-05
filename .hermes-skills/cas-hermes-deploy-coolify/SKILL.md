---
name: cas-hermes-deploy-coolify
description: "Safe Creator AI Studio staging deploy via Coolify/VPS redeploy script."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, coolify, deploy, docker-compose]
---

# CAS Hermes Deploy Coolify

Use for Creator AI Studio deploy validation to staging/Coolify.

## VPS path layout (cas-core-01)

| Path | Purpose |
|------|---------|
| `/home/creator/projects/creator-ai-studio` | **Hermes cwd / git workspace** — full clone with `.git`, owned by `creator` |
| `/root/creator-ai-studio` | **Deploy sync target** — rsync from GitHub Actions, **no `.git`** |

Rules:

- Set Hermes Agent CLI `cwd` to `/home/creator/projects/creator-ai-studio` for git, tests, and code edits.
- Never use `/root/creator-ai-studio` as Hermes cwd — Hermes walks for `.git` when loading context; a root-owned unreadable `.git` there crashes with `PermissionError`.
- Run deploy/redeploy as **root** only: `COMPOSE_FILE=deploy/docker-compose.staging.yml bash /root/creator-ai-studio/scripts/vps-redeploy.sh <tag>`
- After CI rsync, `scripts/vps-post-rsync.sh` removes stray `.git` and restores `+x` on deploy scripts.

## Inputs needed
- Branch and expected commit SHA.
- Target URL.
- Explicit authorization to deploy.

## Safety rules
- Never print secrets, tokens, CAS_API_KEY, API keys, or Authorization headers.
- Stay off `main` unless production promotion is explicitly authorized.
- Stop on merge conflicts.
- Do not modify Coolify variables or environment secrets.

## Allowed commands
- In `/home/creator/projects/creator-ai-studio`: `git fetch --all --prune`, checkout target branch, `git pull --ff-only`.
- `npm run test`, `npm run typecheck`, `npm run build` (from the git workspace above).
- `bash -n scripts/vps-redeploy.sh scripts/patch-worker-cas-key.sh`.
- As root on deploy tree: `bash /root/creator-ai-studio/scripts/vps-redeploy.sh <commit>` when deployment is authorized.
- `docker compose config` and `docker ps` on target host, without env dumps.
- `GET /api/health` and public UI smoke.

## Prohibited actions
- No force push.
- No raw `env`/`printenv` output.
- No manual service start unless script fails and user authorizes follow-up.
- No pipeline/TTS/render/publish.

## Checklist
1. Confirm current branch and clean working tree.
2. Confirm expected commit.
3. Run tests/typecheck/build.
4. Syntax-check redeploy scripts.
5. Sync validated tree if VPS cannot fetch GitHub.
6. Ensure deploy scripts executable on VPS if needed.
7. Run redeploy with final SHA.
8. Confirm compose includes api, web, redis, worker.
9. Confirm containers: api healthy, web up, redis up, worker up.
10. Confirm image tags equal final SHA.
11. Confirm `/api/health` HTTP 200.
12. Confirm UI/auth smoke if scoped.

## Delivery format
Status, summary, branch/commit, local gates, deploy executed, service states, URL, health, problems, next recommendation.
