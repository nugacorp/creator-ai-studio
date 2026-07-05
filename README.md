# Creator AI Studio

Monorepo para gestionar la producción de contenido en video: episodios, pipeline de IA, render, TTS y publicación.

## Stack

- **API** — Fastify (Node.js)
- **Web** — React, Vite, Tailwind CSS
- **Worker** — procesamiento de jobs en background
- **Shared** — tipos y reglas de dominio compartidos

Requisitos: Node.js ≥ 20 y npm.

## Estructura

```
apps/        api + dashboard web
workers/     worker de producción
packages/    código compartido
deploy/      Dockerfiles y compose
docs/        arquitectura, operaciones y gobierno
scripts/     utilidades de despliegue
supabase/    migraciones y config local
```

## Inicio rápido

```bash
npm install
cp .env.example .env   # ajustar valores locales; no commitear .env
```

Terminal 1 — API (`http://localhost:3000`):

```bash
npm run start --workspace @creator-ai-studio/api
```

Terminal 2 — Web (`http://localhost:5173`):

```bash
npm run dev --workspace @creator-ai-studio/web
```

Opcional — worker:

```bash
npm run start --workspace @creator-ai-studio/production-worker
```

La web usa `/api` por defecto. Para otro origen, define `VITE_API_BASE_URL` en `.env` (ver [.env.example](.env.example)).

Los episodios se guardan en disco según `LOCAL_STORAGE_PATH` (por defecto `episodes/`, ignorado por git).

## Calidad

```bash
npm run test
npm run typecheck
npm run build
```

## Documentación

| Tema | Ubicación |
|------|-----------|
| Arquitectura y despliegue | [docs/01-architecture/](docs/01-architecture/) |
| Operaciones (auth, runbook) | [docs/02-operations/](docs/02-operations/) |
| Gobierno del proyecto | [docs/00-governance/](docs/00-governance/) |
| Contenedores y compose | [deploy/README.md](deploy/README.md) |

## Ramas

- `main` — producción
- `staging` — integración y pruebas
- `feature/*` — desarrollo aislado

No subas secretos al repositorio. Usa variables de entorno o el gestor de secretos del entorno de despliegue.
