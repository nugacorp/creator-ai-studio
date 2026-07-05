# Deploy assets

Docker and Compose files for Creator AI Studio. Run all commands from the **repository root** (build context is `.` / `..` from compose).

## Files

| File | Purpose |
|---|---|
| `Dockerfile.api` | Fastify API image |
| `Dockerfile.web` | Vite build + nginx static server |
| `Dockerfile.worker` | Production worker image |
| `docker-compose.staging.yml` | Staging stack (api, web, worker, redis) |
| `docker-compose.production.yml` | Production stack |
| `nginx.web.conf` | nginx config copied into web image |
| `staging.env.example` | Staging env reference |
| `production.env.example` | Production env reference |
| `HTTPS_COOLIFY.md` | SSL setup on Coolify |

## Local / manual build

```bash
docker build -f deploy/Dockerfile.api -t creator-ai-studio-api:local .
docker build -f deploy/Dockerfile.web \
  --build-arg VITE_API_BASE_URL=/api \
  --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key \
  -t creator-ai-studio-web:local .
docker build -f deploy/Dockerfile.worker -t creator-ai-studio-worker:local .
```

`VITE_SUPABASE_*` are **build-time only** (Vite). Staging VPS builds pass them via `scripts/vps-redeploy.sh` reading `/root/creator-ai-studio/.env.supabase.local`. See `docs/02-operations/SUPABASE_AUTH.md`.

## Compose (from repo root)

```bash
docker compose -f deploy/docker-compose.staging.yml up --build
docker compose -f deploy/docker-compose.production.yml up --build
```

## VPS / CI

- Staging: `.github/workflows/deploy-staging.yml` with `COMPOSE_FILE=deploy/docker-compose.staging.yml` → `scripts/vps-redeploy.sh`
- Production: `.github/workflows/deploy-production.yml` with `COMPOSE_FILE=deploy/docker-compose.production.yml`

The VPS redeploy script builds with `-f deploy/Dockerfile.*` and updates the Coolify runtime compose at `/data/coolify/applications/.../docker-compose.yaml`.
