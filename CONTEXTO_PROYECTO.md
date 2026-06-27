# Contexto del Proyecto — Creator AI Studio

> Documento de traspaso (handoff) para retomar el desarrollo en otra herramienta de IA (ej. ChatGPT).
> Resume **qué es el proyecto, cómo está construido y en qué punto va**.
> Fecha de generación: 2026-06-26. Generado a partir del código y la documentación reales del repositorio.

---

## 1. Resumen ejecutivo

**Creator AI Studio (CAS)** es un sistema de producción de video para un **canal de YouTube cristiano basado en la Biblia**. La idea es industrializar la creación de episodios: desde la idea hasta la publicación en YouTube, pasando por guion, narración con IA (TTS), generación de miniaturas, render de video con FFmpeg, SEO y archivado en la nube.

- **Tipo de producto:** plataforma web tipo "Creator OS" (dashboard) + API + worker de producción en background.
- **Estado general:** MVP funcional avanzado. Fases 0–7 marcadas como completadas en el roadmap; **~85% de avance global**. Lo pendiente es sobre todo **verificación de despliegue en producción, claves de API reales y validación end-to-end en staging**.
- **Entorno vivo (staging):** `https://creator-ai-studio.217.76.56.66.sslip.io` (VPS `217.76.56.66`, desplegado con **Coolify** + Docker Compose).
- **Repositorio:** `nugacorp/creator-ai-studio` (monorepo npm workspaces).
- **Rama activa de trabajo:** `staging` (va 8 commits por delante de `main`).

### Roles y convención de trabajo
El proyecto sigue un "sistema operativo de proyecto" (CAS OS) con documentación formal:
- **Claude Code / IA**: desarrolla en ramas `feature/*` y prepara cambios.
- **Hermes** (rol humano/operador): valida, ejecuta y despliega en el VPS.
- Se trabaja por "Work Orders" (ej. `CAS-WO-0003`, `CAS-HERMES-DEPLOY-0023`) registradas en `CHANGELOG.md`.

---

## 2. Objetivo de negocio y dominio

El producto modela el ciclo de vida de un **episodio** de video. Cada episodio atraviesa **15 etapas de producción ordenadas**:

```
planning → research → script → doctrine_review → editorial_review →
storyboard → assets → audio → video → thumbnail → seo → shorts →
final_review → publishing → analytics
```

Cada etapa tiene un estado: `pending`, `in_progress`, `completed`, `blocked`. Al crear un episodio, `planning` queda `completed` y el resto `pending`. Las etapas se pueden avanzar manualmente (antes de conectar agentes reales) o automáticamente vía el pipeline del worker.

Además del modelo de etapas (granular, para producción), existe un **estado de ciclo de vida simplificado** que usa el Kanban del dashboard:

| Estado backend (`EpisodeStatus`) | Columna Kanban (UI) | Progreso |
|---|---|---|
| `draft` | Ideas / Investigación | 10% |
| `scripting` | Guion / Narración IA | 45% |
| `rendering` | Edición / Miniatura | 80% |
| `review` | Programado | 95% |
| `published` | Publicado | 100% |

El modelo de dominio compartido vive en [packages/shared/src/index.ts](packages/shared/src/index.ts): tipos `EpisodeSummary`, `EpisodeDetail`, `EpisodeContent`, `EpisodeStage`, `ProductionJob`, `AppSettings`, `SecretProvider`, etc., más type guards y reglas de transición.

---

## 3. Stack tecnológico

Monorepo **npm workspaces** (Node.js ≥ 20, TypeScript, ESM).

| Área | Tecnología | Ubicación |
|---|---|---|
| Tipos compartidos | TypeScript | `packages/shared` |
| API | **Fastify** (Node.js, ESM) | `apps/api` |
| Web dashboard | **React + Vite + Tailwind CSS v4 + lucide-react + motion** | `apps/web` |
| Worker de producción | Node.js (polling + BullMQ opcional) | `workers/production` |
| Tests | **Vitest** (unit) + **Playwright** (e2e web) | por workspace |
| Cola de jobs | Redis (BullMQ opcional; fallback a polling) | infra |
| Base de datos (opcional) | **Supabase** (Postgres + Auth) | `supabase/` |
| Contenedores | Docker (`Dockerfile.api`, `Dockerfile.web`, `Dockerfile.worker`) | raíz |
| Orquestación | Docker Compose (`docker-compose.staging.yml`) | raíz |
| Despliegue | **Coolify** (PaaS self-hosted) sobre VPS, con Traefik + Let's Encrypt | VPS |
| CI | GitHub Actions (typecheck + test + build) | `.github/workflows` |

Comandos de calidad (desde la raíz):
```bash
npm run typecheck
npm run test
npm run build
```

---

## 4. Estructura del monorepo

```
creator-ai-studio/
├── apps/
│   ├── api/                 # Fastify API (núcleo backend)
│   │   └── src/
│   │       ├── app.ts       # buildApp(): registra TODAS las rutas (con y sin prefijo /api)
│   │       ├── server.ts    # arranque del servidor
│   │       ├── ai/          # Gateway de IA multi-proveedor (gemini, openai, claude, demo)
│   │       ├── auth/        # Hook de auth + verificación de JWT de Supabase
│   │       ├── secrets/     # Almacén cifrado de claves + OAuth Google + test de conexión
│   │       ├── oauth/       # Flujo OAuth de Google (Gemini/YouTube)
│   │       ├── jobs/        # Cola de jobs (store + rutas + BullMQ)
│   │       ├── integrations/# youtube, elevenlabs, piper, tts, webhooks
│   │       ├── media/       # render.ts (FFmpeg: video, shorts, miniatura)
│   │       ├── archive/     # drive.ts (archivado a Google Drive vía rclone)
│   │       ├── storage/     # EpisodeStorage (persistencia en disco) + access (aislamiento por usuario)
│   │       ├── channels/    # CRUD de canales
│   │       ├── settings/    # AppSettings persistidos
│   │       ├── db/          # Cliente Supabase + sync de episodios a Postgres
│   │       └── system/      # storage stats (disco, ffmpeg, piper)
│   └── web/                 # Dashboard React "Creator OS"
│       └── src/
│           ├── App.tsx      # Shell: sidebar + header + ruteo de vistas por estado
│           ├── api.ts       # Cliente HTTP hacia la API
│           ├── components/  # 1 componente por vista (ver §9)
│           ├── context/     # AuthContext (Supabase)
│           └── lib/         # supabase, profile, greeting
├── workers/
│   └── production/          # Worker: procesa jobs (script, tts, render, thumbnail, publish, pipeline)
├── packages/
│   └── shared/              # Tipos + reglas de dominio compartidos
├── supabase/                # config + migraciones SQL + seed
├── deploy/                  # nginx.web.conf, HTTPS_COOLIFY.md, staging.env.example
├── scripts/                 # scripts de despliegue/operación en VPS (bash + PowerShell)
├── docs/                    # documentación formal (arquitectura, operaciones)
├── docker-compose.staging.yml
├── Dockerfile.api / Dockerfile.web / Dockerfile.worker
└── (docs de gobierno) README.md, PROJECT_STATE.md, ROADMAP.md, CHANGELOG.md,
    MASTER_INDEX.md, DOCUMENT_REGISTRY.md, PROJECT_REGISTRY.json
```

---

## 5. Backend API (Fastify)

Definida en [apps/api/src/app.ts](apps/api/src/app.ts). Detalle clave: **todas las rutas se registran dos veces**, con prefijo `/api` (canónico, para tráfico same-origin en staging detrás de nginx) y sin prefijo (compatibilidad local/legacy). Tiene `trustProxy: true`.

### Endpoints principales

**Salud y sistema**
- `GET /api/health` — estado del servicio + estado de conexión a Supabase.
- `GET /api/system/mode` — indica `demoMode`, proveedor de IA activo, proveedor TTS y si TTS está configurado.
- `GET /api/system/storage` — uso de disco, episodios activos/archivados, disponibilidad de FFmpeg/Piper.

**Episodios**
- `GET /api/episodes` — lista (aislada por `userId` si hay auth).
- `GET /api/episodes/:id` — detalle (metadata + etapas + contenido editable).
- `POST /api/episodes` — crea episodio `{ title }`. Valida límite `maxActiveEpisodes` (responde 409 si se supera). Crea carpeta de workspace en disco y sincroniza a Supabase si está configurado.
- `PATCH /api/episodes/:id` — actualiza título/estado/contenido.
- `PATCH /api/episodes/:id/status` — mueve estado vía columna Kanban (`projectStatus`).
- `PATCH /api/episodes/:id/stages/:stage` — cambia el estado de una etapa (con reglas de transición).

**Pipeline / media (sobre un episodio)**
- `POST /api/episodes/:id/pipeline` — encola el pipeline completo (script→…→publish).
- `POST /api/episodes/:id/render` — render de video con FFmpeg.
- `POST /api/episodes/:id/shorts` — render de short vertical.
- `POST /api/episodes/:id/thumbnail` — genera miniatura con IA y la guarda.
- `POST /api/episodes/:id/confirm-publish` — marca publicado; auto-archiva si está activado.
- `POST /api/episodes/:id/archive` — archiva el workspace a Google Drive (rclone).
- `POST /api/episodes/:id/restore` — restaura desde Drive.

**Canales, ajustes, analytics, calendario**
- `GET/POST/PATCH/DELETE /api/channels[/:id]` — CRUD de canales.
- `GET/PATCH /api/settings` — ajustes globales (`AppSettings`).
- `GET /api/analytics` — KPIs (vistas, suscriptores, watch time, engagement) desde YouTube.
- `GET/POST /api/calendar/events` — eventos de calendario derivados de episodios.

**Integraciones**
- `POST /api/integrations/youtube/upload` — sube video a YouTube.
- `GET /api/integrations/elevenlabs/voices` — lista voces.
- `POST /api/integrations/elevenlabs/tts` — sintetiza narración.

**Otros módulos de rutas** (registrados aparte): `registerAIRoutes` (`/api/ai/*` y `/api/gemini/*`), `registerJobRoutes` (`/api/jobs/*`), `registerSecretRoutes` (`/api/secrets/*`), `registerOAuthRoutes` (`/api/oauth/google/*`).

---

## 6. Gateway de IA multi-proveedor

En [apps/api/src/ai/](apps/api/src/ai/). Abstracción `AIProvider` con implementaciones: **Gemini, OpenAI, Claude** y un **DemoAIProvider** de fallback (cuando no hay claves configuradas → "demo mode").

- Resolución de proveedor en [router.ts](apps/api/src/ai/router.ts): usa `AI_<OPERATION>_PROVIDER` (ej. `AI_SCRIPT_PROVIDER`, `AI_IMAGE_PROVIDER`) o `AI_PROVIDER_DEFAULT` (default `gemini`).
- Si no hay credencial para el proveedor elegido, cae a demo automáticamente.
- Registra logs de uso (`AIUsageLog`: proveedor, operación, latencia, timestamp).
- Las rutas exponen tanto `/api/ai/*` (canónico) como `/api/gemini/*` (compatibilidad con el UI importado).

**Importante para retomar:** al ser una app de IA, el modelo Claude por defecto debería ser el más reciente (familia Claude 4.x). Verificar IDs de modelo vigentes antes de hardcodear.

---

## 7. Worker de producción y cola de jobs

En [workers/production/src/index.ts](workers/production/src/index.ts).

- **Dos modos de operación:**
  1. **Polling** (siempre activo): consulta `GET /api/jobs/pending` cada `WORKER_POLL_INTERVAL_MS` (default 5000 ms) y procesa.
  2. **BullMQ** (si `REDIS_URL` está presente): escucha la cola `cas-production`.
- **Tipos de job** (`JobType`): `script`, `tts`, `render`, `thumbnail`, `shorts`, `publish`, `archive`, `pipeline`.
- **El `pipeline`** ejecuta en secuencia: `script → seo → tts → thumbnail → render → shorts → publish → confirm`, reportando progreso (0–90%) y la etapa actual en `result`.
- Se autentica contra la API con `CAS_API_KEY` (Bearer) si está definida. Sin ella, advierte que puede recibir 401 cuando la auth de Supabase está activa.
- El job `publish` falla con mensaje claro si YouTube OAuth no está conectado.

---

## 8. Integraciones externas

| Integración | Módulo | Notas |
|---|---|---|
| **YouTube** (upload + analytics) | `integrations/youtube.ts` | Requiere OAuth Google conectado. Sube el `06-video/episode.mp4`. |
| **ElevenLabs** (TTS de pago) | `integrations/elevenlabs.ts`, `tts.ts` | Voz de narración; guarda audio en `05-audio/`. |
| **Piper** (TTS local/CPU, gratis) | `integrations/piper.ts` | Alternativa a ElevenLabs (`PIPER_BIN`, `PIPER_MODEL`). |
| **FFmpeg** (render) | `media/render.ts` | Video a partir de escenas/imágenes, shorts verticales, miniaturas. |
| **Google Drive** (archivado) | `archive/drive.ts` | Vía **rclone** (`RCLONE_REMOTE`, `RCLONE_CONFIG`). Libera disco del VPS. |
| **Webhooks** | `integrations/webhooks.ts` | Notificaciones de eventos a `WEBHOOK_URL`. |

El proveedor TTS se elige una vez en Settings (`ttsProvider`: `elevenlabs` | `piper` | `gemini`).

---

## 9. Secretos, OAuth de Google y autenticación

### Almacén de secretos cifrado (Settings UI)
En `apps/api/src/secrets/`. Permite **introducir las claves de API desde la pantalla Configuración** del dashboard, en lugar de variables de entorno.
- Requiere `CAS_SECRETS_KEY` (clave maestra de 32+ chars) para cifrar/descifrar.
- Se guardan cifradas en `/data/episodes/.secrets/secrets.enc` (en el volumen persistente).
- Resolución de claves: primero el store cifrado, luego variables de entorno (`SecretSource`: `store` | `env` | `none`).
- Hay endpoints de **test de conexión** por proveedor (`POST /api/secrets/test/:provider`).

### OAuth de Google (Gemini + YouTube)
En `apps/api/src/oauth/` y `secrets/google-auth.ts`.
- Flujo OAuth para obtener acceso a Gemini y YouTube desde Configuración (botón "Conectar").
- Redirect URI: `https://creator-ai-studio.217.76.56.66.sslip.io/api/oauth/google/callback`.
- **Requiere HTTPS** y `CAS_PUBLIC_URL` correcto.
- Para tokens de larga duración, publicar la app OAuth en modo **"In production"** en Google Cloud (ver [docs/02-operations/GOOGLE_OAUTH_PRODUCTION.md](docs/02-operations/GOOGLE_OAUTH_PRODUCTION.md)); en modo "Testing" los refresh tokens caducan a los 7 días.

### Autenticación de usuarios (Supabase Auth) — opcional
En `apps/api/src/auth/` y `apps/web/src/context/AuthContext.tsx`.
- Login email/contraseña con **Supabase Auth** (independiente del OAuth de Google).
- Proyecto staging Supabase: ref `iiokqyedkylwhonbrrvo`, URL `https://iiokqyedkylwhonbrrvo.supabase.co`, org "Creator AI Studio".
- Si se define `SUPABASE_JWT_SECRET` en la API, **todas las rutas `/api/*` (excepto health y OAuth) exigen `Authorization: Bearer <access_token>`**. El hook expone `request.userId` para aislar datos por usuario.
- Si **no** se definen `VITE_SUPABASE_*`, la web funciona **sin login** (comportamiento actual por defecto).
- Migraciones SQL en `supabase/migrations/` (episodios/canales/jobs, perfiles con RLS, política de insert de perfiles).
- Ver [docs/02-operations/SUPABASE_AUTH.md](docs/02-operations/SUPABASE_AUTH.md).

---

## 10. Frontend — Dashboard "Creator OS"

`apps/web` es la **interfaz oficial**, importada del repo de referencia `nugacorp/Creator-AI-Studio-ui-ux` (reemplazó al frontend MVP anterior). Stack: React + Vite + Tailwind v4 + lucide-react + motion. Tema oscuro (`#0B0F14`).

[App.tsx](apps/web/src/App.tsx) es el shell (Sidebar + Header) y rutea vistas por estado (`currentView`). Las 13 vistas del sidebar están **todas cableadas al backend**:

| Vista (sidebar) | Componente | Estado de conexión |
|---|---|---|
| Home | `HomeView` | Conectada (proyectos, crear episodio, importar guion) |
| Proyectos | `ProjectsView` | Conectada — Kanban con sync (`PATCH .../status`) |
| Contenido / Workspace | `WorkspaceView` | Conectada — persistencia de contenido (`PATCH /episodes/:id`) |
| IA Copilot | `CopilotView` | Conectada — rutas de IA |
| Biblioteca IA | `LibraryView` | Conectada — generación con IA |
| Publicaciones / Calendar | `CalendarView` | Conectada — eventos desde API |
| Analytics | `AnalyticsView` | Conectada — datos de YouTube |
| Automatización | `AutomationView` | Conectada — cola de jobs |
| Agentes IA | `AgentsView` | Conectada — mapeo de etapas |
| Modo Producción | `ProductionView` | Conectada |
| Modo Multicanal | `MultichannelView` | Conectada — API de canales |
| Equipos | `TeamsView` | Estado local (mock en memoria) |
| Configuración | `SettingsView` | Conectada — settings + secretos + OAuth |

Componentes de apoyo: `PipelinePanel` (lanza/observa el pipeline), `ProductionStagesPanel` (etapas), `DemoModeBanner` (avisa cuando no hay claves → modo demo), `ProfileEditor`, `LoginView`.

**Ruteo API del frontend:** por defecto llama al base path same-origin `/api`. Override solo con `VITE_API_BASE_URL` para entornos no estándar. En staging, nginx (en el contenedor web) sirve los assets estáticos y hace proxy de `/api` → `http://api:3000/api`.

Hay tests: `apps/web/test/*` (Vitest) y `apps/web/e2e/basic.spec.ts` (Playwright).

---

## 11. Despliegue (staging)

- **Plataforma:** Coolify sobre VPS `217.76.56.66`, con Traefik enrutando `Host(creator-ai-studio.217.76.56.66.sslip.io)` al contenedor web (puerto 8080).
- **Compose:** [docker-compose.staging.yml](docker-compose.staging.yml) define 4 servicios:
  - `api` (Fastify, puerto 3000 **solo interno**, healthcheck, volumen `/data/episodes`).
  - `web` (nginx + assets Vite, puerto 8080, **único público**, hace proxy de `/api`).
  - `worker` (procesa jobs, depende de api healthy + redis).
  - `redis` (`redis:7-alpine`, backend de cola).
- **Volúmenes persistentes:** `creator-ai-studio-staging-episodes` → `/data/episodes` (episodios, secretos cifrados, `settings.json`); `creator-ai-studio-rclone-config` → `/config/rclone` (read-only).
- **HTTPS:** Let's Encrypt vía Coolify (necesario para OAuth de Google). Ver `deploy/HTTPS_COOLIFY.md`.
- **Scripts de operación** en `scripts/` (bash para el VPS): `vps-redeploy.sh`, `enable-worker-staging.sh`, `vps-deploy-api-only.sh`, `vps-fix-compose-and-up.sh`, etc. Y PowerShell para Supabase (`supabase-create-and-push.ps1`, `supabase-setup.ps1`).
- **CI** (GitHub Actions): corre `typecheck`, `test`, `build` en push/PR a `main`, `staging` y `feature/*`. Hay también `deploy-staging.yml`.

### Verificación de salud
```bash
curl -i https://creator-ai-studio.217.76.56.66.sslip.io/api/health
# Esperado: {"status":"ok","service":"creator-ai-studio-api", ...}
```

---

## 12. Variables de entorno (resumen operativo)

Plantilla completa en [.env.example](.env.example) y `deploy/staging.env.example`.

| Variable | Servicio | Obligatoria | Propósito |
|---|---|---|---|
| `API_HOST` / `API_PORT` | API | Sí | Host/puerto (`0.0.0.0` / `3000`). |
| `LOCAL_STORAGE_PATH` | API, Worker | Sí | Ruta de episodios (volumen persistente, `/data/episodes`). |
| `CAS_SECRETS_KEY` | API | Sí (para guardar claves desde UI) | Clave maestra de cifrado (32+ chars). |
| `CAS_PUBLIC_URL` | API | Recomendada | URL pública para redirects OAuth (con `https://`). |
| `CAS_API_KEY` | API, Worker | Opcional | Auth simple por API key (worker usa la misma). |
| `AI_PROVIDER_DEFAULT` | API | Recomendada | Proveedor IA por defecto (`gemini`). |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | API | Opcional | Claves IA (o configurarlas desde Settings UI). |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | API | Opcional | OAuth Google (Gemini/YouTube). |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | API | Opcional | TTS de pago. |
| `PIPER_BIN` / `PIPER_MODEL` | API | Opcional | TTS local. |
| `RCLONE_REMOTE` / `RCLONE_CONFIG` | API | Opcional | Archivado a Google Drive. |
| `WEBHOOK_URL` | API | Opcional | Notificaciones de eventos. |
| `REDIS_URL` | API, Worker | Opcional | Cola BullMQ (`redis://redis:6379`). |
| `WORKER_POLL_INTERVAL_MS` / `API_BASE_URL` | Worker | Sí (worker) | Polling y base URL (`http://api:3000/api`). |
| `SUPABASE_JWT_SECRET` | API | Opcional | Activa auth de usuarios (protege `/api/*`). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | API | Opcional | Sync de episodios a Postgres. |
| `VITE_API_BASE_URL` | Web (build) | Opcional | Override del base path (default `/api`). |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Web (build) | Opcional | Habilita login en la web. |

> **Regla:** los secretos nunca se commitean al repo.

---

## 13. Estado actual y roadmap

Según [ROADMAP.md](ROADMAP.md) y [PROJECT_STATE.md](PROJECT_STATE.md):

| Fase | Nombre | Estado |
|---|---|---|
| 0 | MVP Staging & CI | ✅ Completada |
| 1 | Modelo de datos unificado | ✅ Completada |
| 2 | Gateway de IA multi-proveedor | ✅ Completada |
| 3 | Vistas conectadas | ✅ Completada |
| 4 | Worker y cola de jobs | ✅ Completada |
| 5 | Auth y base de datos (Supabase) | ✅ Completada |
| 6 | Integraciones externas | ✅ Completada |
| 7 | Endurecimiento de producción | ✅ Completada (deploy pendiente de verificar) |

**Avance global estimado: ~85%.**

### Pendientes / próximos pasos (lo que falta)
1. **Verificar el despliegue en Coolify** con claves de IA reales configuradas y hacer smoke test end-to-end (crear episodio → guion → narración → render → publicar).
2. **Configurar claves de API reales** en producción (Gemini/OpenAI/Claude, ElevenLabs, YouTube OAuth).
3. **Migración/uso de Supabase** para multi-usuario cuando se necesite (asignar `user_id` al crear episodios es una tarea de "Fase 2" mencionada en `SUPABASE_AUTH.md`).
4. **Promover `staging` validado a `main`** (producción). Hoy `staging` va 8 commits adelante de `main`.
5. Publicar la app OAuth de Google en modo "In production" para tokens de larga duración.

**Bloqueos actuales:** ninguno registrado.

---

## 14. Flujo de ramas (Git)

Modelo de tres niveles:

| Rama | Entorno | Propósito |
|---|---|---|
| `main` | Producción | Estado estable, siempre desplegable. |
| `staging` | Testing/Integración | Validación antes de promover a producción. **Rama de trabajo actual.** |
| `feature/*` | Desarrollo | Trabajo aislado por tarea. |

Flujo: `feature/*` → `staging` (integración/test) → `main` (producción).
Reglas: **sin force push** ni borrado de ramas compartidas (`main`, `staging`); secretos nunca al repo.

Ramas existentes ahora: `main`, `staging` (actual), `feature/secrets-module`.

### Commits recientes relevantes (rama staging)
```
9d89667 Enable end-to-end pipeline with user isolation and staging deploy
2a3b838 fix: strip CRLF when sourcing .env.supabase.local on VPS redeploy
6fb1e02 feat: editable user profile in settings via Supabase profiles
9f34c6c feat: add Supabase Auth login, JWKS API guard, and CLI migrations
10ef217 feat: production hardening for OAuth, YouTube, analytics, and worker
5285358 fix: nginx PATCH body forwarding for secrets save on HTTPS
21758c5 feat: Google OAuth connect, HTTPS staging, and settings save feedback
3f4d2fe feat: production pipeline with FFmpeg, Drive archive, and unified TTS
eacd758 feat: secrets module, integrations, worker pipeline, and production hardening
8288d4d feat: wire production-ready API, AI gateway, and full dashboard integration
51b6531 feat: integrate google ai studio dashboard ui
```

---

## 15. Cómo correr el proyecto localmente

Requisitos: Node.js ≥ 20 y npm.

```bash
# 1. Instalar dependencias (desde la raíz)
npm install
# Si falla por TLS de proxy corporativo:
NODE_OPTIONS=--use-system-ca npm install

# 2. API (Fastify, http://localhost:3000)
npm run start --workspace @creator-ai-studio/api

# 3. Web (Vite, http://localhost:5173)
npm run dev --workspace @creator-ai-studio/web

# 4. Worker (opcional)
npm run start --workspace @creator-ai-studio/production-worker

# 5. Supabase local (opcional, Docker)
npm run supabase:start
npm run supabase:status
npm run supabase:reset
```

Sin claves de IA configuradas, la app corre en **modo demo** (respuestas simuladas) y muestra el `DemoModeBanner`. Los episodios se guardan en disco bajo `LOCAL_STORAGE_PATH` (default `episodes/`, git-ignored).

---

## 16. Convenciones y documentación de gobierno

El repo incluye un "sistema operativo de proyecto" (CAS OS) con documentación formal y plantillas:
- **Entrypoints:** `README.md`, `MASTER_INDEX.md`, `PROJECT_STATE.md`, `ROADMAP.md`, `CHANGELOG.md`, `DOCUMENT_REGISTRY.md`, `PROJECT_REGISTRY.json`.
- **Estándares:** `.system/standards/DOCUMENTATION_STANDARD.md` y `DOCUMENT_STANDARD.md` (los documentos `.md` siguen un formato con Document ID, Title, Version, Status, Author, Change History).
- **Plantillas:** `templates/*.md` (ADR, decisión, roadmap, work order, workflow, etc.).
- **Docs técnicos:** `docs/01-architecture/` (TECH_STACK, DEPLOYMENT_STAGING), `docs/02-operations/` (RUNBOOK, SUPABASE_AUTH, GOOGLE_OAUTH_PRODUCTION).
- Los cambios importantes se registran en `CHANGELOG.md` referenciando una Work Order.

---

## 17. Puntos de atención al retomar el desarrollo

- **Doble registro de rutas** (`''` y `/api`): si añades un endpoint, hazlo dentro del bucle de prefijos en `app.ts` para mantener compatibilidad.
- **Modelo de IA:** al ser app de IA, usar modelos Claude más recientes (familia 4.x) y verificar IDs vigentes; no asumir modelos antiguos.
- **Demo mode vs. real:** muchas features (IA, TTS, YouTube) "funcionan" en demo sin claves; el valor real requiere configurar credenciales (preferentemente desde Settings UI con `CAS_SECRETS_KEY`).
- **Aislamiento por usuario:** ya existe `request.userId` y `storage/access.ts`; al activar Supabase Auth, validar que la creación de episodios asocia `userId` correctamente (tarea pendiente).
- **Persistencia:** todo depende del volumen `/data/episodes`. No perderlo entre redeploys.
- **OAuth requiere HTTPS** y que `CAS_PUBLIC_URL` coincida exactamente con la URL del navegador.
- **Promoción a producción:** `staging` está adelantado respecto a `main`; el siguiente hito formal es validar y promover.

---

*Fin del documento de contexto. Para profundizar, los archivos fuente más informativos son: [packages/shared/src/index.ts](packages/shared/src/index.ts) (dominio), [apps/api/src/app.ts](apps/api/src/app.ts) (API), [workers/production/src/index.ts](workers/production/src/index.ts) (pipeline) y [apps/web/src/App.tsx](apps/web/src/App.tsx) (frontend).*
