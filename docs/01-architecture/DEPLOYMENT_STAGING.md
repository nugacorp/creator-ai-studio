## Document ID

DEPLOYMENT_STAGING

## Title

Coolify Staging Deployment

## Version

0.2.0

## Status

Draft

## Author

Hermes

## Created

2026-06-25

## Last Updated

2026-06-25

## Purpose

Define the non-production staging deployment configuration for Creator AI Studio on Coolify.

## Scope

This document covers deployment of the `staging` branch only. It does not define production deployment and does not store real secrets.

### Branch

- Staging branch: `staging`
- Production stable branch: `main`
- Rule: `main` remains the stable production branch and must not be changed or deployed as part of staging validation.

### Services

| Service | Source | Runtime | Required | Notes |
|---|---|---|---|---|
| API | `apps/api` | Node.js Fastify | Yes | Exposes `/api/health`, `/api/episodes`, and backward-compatible unprefixed endpoints. |
| Web | `apps/web` | Vite static build served by nginx | Yes | Public entrypoint. Proxies same-origin `/api` traffic to the internal API service. |
| Worker | `workers/production` | Node.js | Yes | Polls `/api/jobs/pending` and runs the production pipeline (script → TTS → render → publish). Requires Redis. |
| Redis | `redis:7-alpine` | Redis | Yes | Job queue backend for worker and optional BullMQ in API. |

### Deployment Strategy

Recommended Coolify strategy for staging:

1. Create a Coolify project/environment dedicated to Creator AI Studio staging.
2. Connect the repository `git@github.com:nugacorp/creator-ai-studio.git`.
3. Select branch `staging`.
4. Deploy with `docker-compose.staging.yml` from the repository root.
5. Expose only the web service publicly on port `8080`.
6. Keep the API service internal to the Compose network; nginx in the web service proxies `/api` to `http://api:3000/api`.
7. Mount a persistent volume for the API at `/data/episodes` (secrets and settings persist under that path).
8. Worker and Redis start by default with `docker-compose.staging.yml`.

### Staging URL

| Field | Value |
|---|---|
| Display name | Creator AI Studio |
| Public URL | `https://creator-ai-studio.217.76.56.66.sslip.io` (enable SSL in Coolify; see [deploy/HTTPS_COOLIFY.md](../../deploy/HTTPS_COOLIFY.md)) |
| FQDN | `creator-ai-studio.217.76.56.66.sslip.io` |
| Server IP | `217.76.56.66` |

The sslip.io hostname uses `creator-ai-studio` (hyphens) because DNS labels cannot contain spaces. Coolify Traefik routes `Host(creator-ai-studio.217.76.56.66.sslip.io)` to the web container on port `8080`.

Reference copy: [deploy/staging.env.example](../../deploy/staging.env.example).

### Variables de entorno

| Variable | Service | Required | Example / Placeholder | Notes |
|---|---|---:|---|---|
| `NODE_ENV` | API, Worker | Yes | `production` | Non-secret runtime mode. |
| `API_HOST` | API | Yes | `0.0.0.0` | Required inside container. |
| `API_PORT` | API | Yes | `3000` | API listens on this port. |
| `LOCAL_STORAGE_PATH` | API, Worker | Yes | `/data/episodes` | Must point to a persistent mounted volume. |
| `CAS_PUBLIC_URL` | API | No | `https://creator-ai-studio.217.76.56.66.sslip.io` | Public URL for OAuth redirects (must match browser URL, include `https://` when SSL is enabled). |
| `VITE_API_BASE_URL` | Web build | No | `/api` | Optional override. Leave unset/defaulted to `/api` in staging so the dashboard uses the same-origin nginx proxy. |

### HTTPS (Google OAuth)

Google OAuth in **production** mode requires `https://` URLs. Enable Let's Encrypt in Coolify before configuring Google OAuth. Steps: [deploy/HTTPS_COOLIFY.md](../../deploy/HTTPS_COOLIFY.md).

For long-lived refresh tokens (avoid re-login every 7 days): [docs/02-operations/GOOGLE_OAUTH_PRODUCTION.md](../02-operations/GOOGLE_OAUTH_PRODUCTION.md).

Configure TTS for real narration: set `ELEVENLABS_API_KEY` in Coolify or configure Piper (`PIPER_BIN`, `PIPER_MODEL`) on the API container. See [deploy/staging.env.example](../../deploy/staging.env.example).

Archive to Google Drive is optional. Set `RCLONE_REMOTE` when ready; `autoArchiveOnPublish` defaults to `false` until configured.

### Volúmenes

| Volume | Mount | Service | Purpose |
|---|---|---|---|
| `creator-ai-studio-staging-episodes` | `/data/episodes` | API, Worker | Persistent episode workspaces, encrypted secrets (`.secrets/secrets.enc`), and `settings.json`. |

The API resolves episode storage from `LOCAL_STORAGE_PATH`; in staging this must be `/data/episodes` so data survives container restarts and redeploys.

### Build / Start Commands

API Docker image:

```bash
docker build -f Dockerfile.api -t creator-ai-studio-api:staging .
docker run --rm \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=3000 \
  -e LOCAL_STORAGE_PATH=/data/episodes \
  -v creator-ai-studio-staging-episodes:/data/episodes \
  creator-ai-studio-api:staging
```

Web Docker image:

```bash
docker build -f Dockerfile.web \
  --build-arg VITE_API_BASE_URL=/api \
  -t creator-ai-studio-web:staging .
docker run --rm -p 8080:8080 creator-ai-studio-web:staging
```

Optional worker Docker image:

```bash
docker build -f Dockerfile.worker -t creator-ai-studio-worker:staging .
docker run --rm \
  -e LOCAL_STORAGE_PATH=/data/episodes \
  -v creator-ai-studio-staging-episodes:/data/episodes \
  creator-ai-studio-worker:staging
```

Compose staging deployment:

```bash
docker compose -f docker-compose.staging.yml up --build
```

Optional worker profile:

```bash
docker compose -f docker-compose.staging.yml --profile worker up --build
```

### Puertos

| Service | Container Port | Recommended Coolify Exposure |
|---|---:|---|
| API | `3000` | Internal Compose network only; do not expose publicly unless a later Work Order requires it. |
| Web | `8080` | Public staging web domain; proxies `/api` to the API service. |
| Worker | none | Do not expose. |

### Coolify Commands / Settings

In Coolify, use these settings for the staging resource:

- Deployment type: Docker Compose.
- Compose file: `docker-compose.staging.yml`.
- Branch: `staging`.
- Build context: repository root.
- Web service public port: `8080`.
- API service port: `3000` internal only; do not attach a public staging API domain by default.
- nginx in the web service proxies `/api` to `http://api:3000/api`.
- Persistent volume: mount `creator-ai-studio-staging-episodes` to `/data/episodes` on the API service.
- Web API base path: use default `/api`; only set `VITE_API_BASE_URL` for non-standard environments.
- Do not configure production domains for this environment.
- Do not configure real third-party secrets for this MVP.

### Checklist de Deploy

Before deploy:

- [ ] Confirm Coolify resource uses branch `staging`.
- [ ] Confirm it does not point to `main`.
- [ ] Confirm the web service is the only public service by default.
- [ ] Confirm nginx proxies `/api` to `http://api:3000/api`.
- [ ] Confirm `LOCAL_STORAGE_PATH=/data/episodes` for API.
- [ ] Confirm persistent volume is mounted at `/data/episodes`.
- [ ] Confirm no production domain is attached.
- [ ] Confirm no real OpenAI, Claude, ElevenLabs, or YouTube secrets are configured.

After deploy:

- [ ] Confirm API container is healthy.
- [ ] Confirm web container is reachable.
- [ ] Confirm `GET /api/health` through the public web domain returns HTTP 200.
- [ ] Confirm `GET /api/episodes` through the public web domain returns HTTP 200 and a JSON array.
- [ ] Create a non-production test episode only if a Work Order authorizes data creation.

### Health Validation

Validate API health through the public web domain and same-origin nginx proxy:

```bash
curl -i https://creator-ai-studio.217.76.56.66.sslip.io/api/health
```

Expected response:

```json
{"status":"ok","service":"creator-ai-studio-api"}
```

Validate episode listing:

```bash
curl -i http://creator-ai-studio.217.76.56.66.sslip.io/api/episodes
```

Expected response for an empty staging volume:

```json
[]
```

## Dependencies

TECH_STACK.md, Dockerfile.api, Dockerfile.web, docker-compose.staging.yml

## Related Documents

DOCUMENT_REGISTRY.md, PROJECT_REGISTRY.json, docs/01-architecture/TECH_STACK.md

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial Coolify staging deployment document created for CAS-HERMES-DEPLOY-0023. |
| 2026-06-25 | 0.2.0 | Hermes | Documented same-origin `/api` nginx proxy strategy for staging. |
| 2026-06-26 | 0.3.0 | Cursor | Documented staging URL `creator-ai-studio.217.76.56.66.sslip.io`. |
