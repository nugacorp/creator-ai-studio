---
name: cas-worker-redis-ops
description: Operate Creator AI Studio production worker and Redis — service health, pending/active jobs, avoid double execution, CAS_API_KEY auth without printing it. No YouTube publish.
---

# CAS Worker & Redis Operations

Monitor and troubleshoot the **production worker** and **Redis** queue on staging/VPS.

## Services

```bash
# On VPS — sanitized status only (from vps-redeploy verify or docker ps)
docker compose -f /data/coolify/applications/<app>/docker-compose.yaml ps worker redis
```

Expected: both `running`; worker healthy after API reachable.

## Worker behavior

- Polls `GET /api/jobs/pending` with `Authorization: Bearer <CAS_API_KEY>` (never print key).
- Claims job → `active` → executes by type: `agent`, `tts`, `render`, `thumbnail`, `publish_package`, etc.
- On success → `completed`; on failure → `failed` with sanitized error stored.

## Redis

- URL typically `redis://redis:6379` inside compose network.
- Required for BullMQ / job coordination when worker profile enabled.

## Checks

| Check | How |
|-------|-----|
| Worker up | Container running, logs show poll loop |
| Redis up | `redis` container running; worker connects without ECONNREFUSED |
| No duplicate runs | Same job id not processed twice concurrently |
| API reachable | Worker waits/retries API ready (`waitForApiReady`) |
| Auth | 401 on jobs endpoints if key wrong — fix env, redeploy |

## Logs (sanitized)

```bash
docker logs <worker-container> --tail 100
```

Report job ids and statuses — **not** env vars or Authorization headers.

## Safe operations

- Restart worker container after env key rotation (redeploy script).
- Clear stuck jobs only with explicit WO (document episode/job ids).

## Do not

- Publish to YouTube from worker validation.
- Print `CAS_API_KEY` or Redis passwords.

## References

- [workers/production/src/index.ts](../../workers/production/src/index.ts)
- [scripts/enable-worker-staging.sh](../../scripts/enable-worker-staging.sh)
- [docs/02-operations/RUNBOOK.md](../../docs/02-operations/RUNBOOK.md)
