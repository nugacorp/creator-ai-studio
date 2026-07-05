---
name: cas-worker-redis-ops
description: "Operate and validate Creator AI Studio worker and Redis safely."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, worker, redis, jobs, ops]
---

# CAS Worker Redis Ops

Use for worker/Redis health, job queue diagnostics, and safe operations.

## Inputs needed
- Target environment.
- Expected commit/deploy.
- Whether job execution is authorized.

## Safety rules
- Never print CAS_API_KEY, env values, tokens, or Authorization headers.
- Avoid double execution of jobs.
- Do not run publish/confirm-publish unless explicitly authorized.
- Do not manually start/stop services unless the Work Order authorizes remediation.

## Checklist
1. Confirm worker container/service is up.
2. Confirm Redis container/service is up.
3. Confirm API can serve `/api/health`.
4. Confirm worker authenticates to API using CAS_API_KEY without printing it.
5. Inspect pending/active/completed/failed jobs through safe API or storage views.
6. Confirm no duplicate workers are consuming the same queue unless designed.
7. Review logs with secret-safe filters.
8. For stuck jobs, report job id/type/status/progress only.
9. Do not retry jobs that can publish externally without explicit authorization.

## Allowed commands
- `docker ps` service status.
- Bounded `docker logs --tail N` with secret redaction awareness.
- Internal API calls that do not print auth values.

## Delivery format
Status, worker/redis/api state, pending jobs summary, duplicate execution risk, sanitized errors, next recommendation.
