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
- `git fetch --all --prune`, checkout target branch, `git pull --ff-only`.
- `npm run test`, `npm run typecheck`, `npm run build`.
- `bash -n scripts/vps-redeploy.sh scripts/patch-worker-cas-key.sh`.
- `scripts/vps-redeploy.sh <commit>` when deployment is authorized.
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
