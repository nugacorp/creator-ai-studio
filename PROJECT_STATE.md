## Document ID

PROJECT_STATE

## Title

Project State

## Version

2.1.0

## Status

Active — Post-pivote (plataforma del equipo digital de iglesia)

## Author

Cursor + Hermes + Claude + Codex

## Created

2026-06-25

## Last Updated

2026-08-09 (verificación post-pivote y plan Church Public Portal V1 contra `main` @ `fe52bc2`)

## HEAD verificado

| Item | Valor |
|---|---|
| Rama actual | `main` |
| HEAD | `fe52bc2383d8ca6fb239f21cf4e6f4560ffcc1c7` |
| Commit | `feat: Implement initial church platform module` (2026-08-05) |
| Working tree al iniciar esta orden | Cambios documentales existentes: `M PROJECT_STATE.md`, `?? docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md` |
| Ramas existentes | `main`, `origin/main` — **la rama `staging` ya no existe** |
| Remoto | `https://github.com/nugacorp/creator-ai-studio.git` |
| Tags | Ninguno |
| Verificación local 2026-08-09 | `npm run typecheck`, `npm run test`, `npm run build` pasan |

> **Fuente de verdad canónica.** Este archivo se verifica contra el repositorio, no contra documentos previos. `docs/00-governance/PROJECT_STATE.md` es un puntero a este archivo; `docs/00-governance/ROADMAP.md` y `docs/02-operations/STAGING_SNAPSHOT.md` son snapshots históricos pre-pivote.

## Purpose

Mantener el estado oficial y verificado de Creator AI Studio tras el cambio de rumbo a plataforma del equipo digital de iglesia.

---

## 1. Identidad actual del proyecto

**Creator AI Studio es una plataforma operativa para el equipo digital de una iglesia.**

Nació (2026-06-25) como estudio de producción automatizada para un canal bíblico de YouTube. El 2026-08-03 se declaró el cambio de rumbo en [docs/03-product/PLAN_IGLESIA_EQUIPO_DIGITAL.md](docs/03-product/PLAN_IGLESIA_EQUIPO_DIGITAL.md) y [docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md](docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md). El pivote está implementado en código desde `fe52bc2`.

### 1.1 Qué sigue vigente del sistema anterior

Verificado en `apps/api/src/`:

| Componente | Ubicación | Estado |
|---|---|---|
| Auth Supabase JWT (`jose`) | `apps/api/src/auth/` | Vigente, ahora base del RBAC |
| Cola de jobs + worker | `apps/api/src/jobs/`, `workers/production/` | Vigente — 14 tipos de job, polling cada 5 s |
| Storage de episodios (14 etapas) | `apps/api/src/storage/` | Vigente como legado; puente `productions.legacy_episode_id` |
| YouTube OAuth + upload | `apps/api/src/integrations/`, `oauth/` | Vigente |
| Archive rclone → Drive | `apps/api/src/archive/` | Vigente en código |
| Router IA multi-proveedor | `apps/api/src/ai/router.ts` | Vigente |
| Subtítulos + TTS | `apps/api/src/media/`, `integrations/` | Vigente, opcional |
| Calendario + post dominical | `apps/api/src/calendar/` | Vigente (módulo legacy, distinto de `church-ops/calendar-routes.ts`) |
| DAM legacy | `apps/api/src/digital-assets/` | **Coexiste** con el DAM nuevo `church-ops/assets-routes.ts` |

### 1.2 Reencuadres aplicados

| Antes | Ahora |
|---|---|
| "Episodio" del canal | **Producción** (`sermon`, `clip`, `reel`, `anuncio`, `testimonio`, `devocional`) |
| 14 agentes en cadena obligatoria | Asistentes opcionales invocados manualmente |
| "Canal" de YouTube | `publish_targets` multiplataforma |

### 1.3 Congelado, degradado u oculto

| Elemento | Decisión | Verificación |
|---|---|---|
| Ideación automática de temas | Congelado | Módulo `ideas/` sigue en código, fuera del flujo de iglesia |
| Guion completo por IA | Degradado a opcional | — |
| TTS narración obligatoria | Degradado a opcional | — |
| `AutomationView` | Maqueta, no conectada al backend | `apps/web/src/components/AutomationView.tsx` |
| Agent Studio | Sigue disponible en shell legacy | `apps/web/src/components/AgentStudioView.tsx` |

---

## 2. Arquitectura real (verificada)

### 2.1 Monorepo

npm workspaces, Node ≥ 20:

```
apps/api           @creator-ai-studio/api          Fastify 5.2 + @fastify/multipart + jose
apps/web           @creator-ai-studio/web          React + Vite + Tailwind
workers/production @creator-ai-studio/production-worker
packages/shared    tipos y matriz de permisos compartidos
supabase/          migraciones (PostgreSQL 17, PostgREST v14.5)
deploy/            Dockerfiles, compose staging/producción, nginx
```

**Dependencias de la API (verificado en `apps/api/package.json`):** `@creator-ai-studio/shared`, `@fastify/multipart`, `bullmq`, `fastify`, `jose`. **No hay `@fastify/cors`. No hay `zod`. No hay `obs-websocket-js`.**

### 2.2 Módulos `church-ops` realmente presentes

`apps/api/src/church-ops/` — 10 archivos, 47 handlers HTTP, montados dos veces (prefijo `''` y `'/api'`) desde [app.ts](apps/api/src/app.ts):

| Archivo | Contenido |
|---|---|
| `routes.ts` | Registro + `/church/today` + `/church/insights` |
| `core-routes.ts` | Iglesias, miembros, ministerios, roles, targets |
| `assets-routes.ts` | DAM: alta, upload, versiones, archivo, miniatura |
| `productions-routes.ts` | Producciones, estado, comentarios, aprobaciones |
| `calendar-routes.ts` | `calendar_entries` |
| `live-routes.ts` | `live_events`, checklist, incidentes |
| `context.ts` | Resolución de iglesia + rol por request |
| `postgrest.ts` | Cliente PostgREST (`userClient` / `serviceClient`) |
| `mappers.ts` | Fila SQL ↔ tipo compartido |
| `asset-files.ts` | Escritura en volumen, `MAX_ASSET_BYTES` (5 GB por defecto) |

Rutas registradas (30 paths distintos): `/church`, `/church/me`, `/church/roles`, `/church/members[/:id]`, `/church/ministries[/:id]`, `/church/targets[/:id]`, `/church/assets[/:id][/file|/thumbnail|/versions]`, `/church/assets/upload`, `/church/assets-summary`, `/church/productions[/:id][/status|/comments]`, `/church/approvals[/:id/decide]`, `/church/calendar[/:id]`, `/church/live-events[/:id][/checklist/:itemId|/incidents]`, `/church/today`, `/church/insights`.

### 2.3 Shell web de iglesia

`apps/web/src/church/` — **seis espacios**, definidos en `CHURCH_SPACES` ([ChurchShell.tsx:35-47](apps/web/src/church/ChurchShell.tsx#L35-L47)):

`today` (Hoy) · `library` (Biblioteca) · `productions` (Producciones) · `live` (En Vivo) · `calendar` (Calendario) · `team` (Equipo)

Convive con el dashboard legacy: [App.tsx:169](apps/web/src/App.tsx#L169) enruta por `isChurchSpace(currentView)`. Los módulos legacy (Home, Proyectos, Workspace, Multicanal, Agent Studio, Modo Producción, Automatización, Copilot, Ideas) siguen accesibles.

### 2.4 Auth, RBAC y RLS — tres capas verificadas

1. **Autenticación** ([auth/middleware.ts](apps/api/src/auth/middleware.ts)) — hook `onRequest` global. Supabase JWT o `CAS_API_KEY` estático. Falla cerrado en producción. Rutas públicas hoy: `/health`, `/api/health`, `/auth/status`, `/api/auth/status`, `/system/mode`, `/api/system/mode`, más los prefijos `/oauth/` y `/api/oauth/`. **Ese conjunto es toda la superficie no autenticada existente.**
2. **Autorización** ([auth/rbac.ts](apps/api/src/auth/rbac.ts) + [auth/route-permissions.ts](apps/api/src/auth/route-permissions.ts)) — 5 roles (`admin`, `lider`, `productor`, `disenador`, `voluntario`) y 13 permisos. Las rutas `/church/*` declaran su propio `requirePermission`; las rutas legacy pasan por la tabla `ROUTE_PERMISSIONS` con escape para operador sin iglesia.
3. **RLS en Postgres** ([supabase/migrations/20260804120000_church_platform.sql](supabase/migrations/20260804120000_church_platform.sql)) — 10 tablas con RLS activo y políticas basadas en `public.church_can()` / `public.is_church_member()`, funciones `security definer` que resuelven el rol vía `auth.uid()`. La API consulta PostgREST **con el token del usuario** (`userClient`), de modo que RLS es la capa real de enforcement. `serviceClient()` (service_role, bypassa RLS) se usa solo en dos puntos de `core-routes.ts`.

> **Consecuencia para el portal público:** `auth.uid()` es `null` para un visitante anónimo, por lo que **hoy ningún dato es legible sin sesión**. No existe ningún `GRANT` a `anon` ni vista pública en las migraciones. Cualquier acceso público requiere diseño explícito.

### 2.5 DAM y almacenamiento real

- Índice en `public.church_assets` (con `search_tsv` en español y GIN sobre `tags`).
- Bytes en el volumen del VPS vía `asset-files.ts`; streaming con soporte de `Range` en [assets-routes.ts:407](apps/api/src/church-ops/assets-routes.ts#L407).
- Límite `CAS_MAX_ASSET_BYTES`, por defecto **5 GB**.
- Metadatos de iglesia: `ministry_id`, `series`, `preacher`, `bible_ref`, `tags`, `service_date`, `versions`, `archived_at`, `drive_id`.
- **No existe campo de visibilidad.** `church_assets` no tiene `visibility` ni equivalente: hoy todo el DAM es interno por construcción.

### 2.6 Integración OBS — **no existe**

⚠️ **Corrección respecto a documentos previos.** El plan técnico describe control de OBS por `obs-websocket` v5 (AD-2), pero **no está implementado**:

- No hay `obs-websocket-js` en ningún `package.json`.
- No hay ninguna referencia a OBS en `apps/api/src/`.
- Lo único existente es el campo de texto `live_events.obs_profile` y un input "Perfil de OBS" en la UI.
- El propio código lo documenta como futuro: *"OBS control lands on top of…"* ([LiveView.tsx:41](apps/web/src/church/views/LiveView.tsx#L41)).

"En Vivo" hoy es **planificación de transmisiones**: evento, horario, crew, checklist de preflight, incidentes y estado manual (`planeado | preflight | en_vivo | finalizado`).

### 2.7 Publish targets

Tabla `publish_targets`, plataformas admitidas por CHECK: `youtube`, `facebook`, `instagram`, `tiktok`, `x`. Modo `auto | assisted` (por defecto `assisted`). `AUTO_CAPABLE_PLATFORMS` = `['youtube','facebook']`. Presets de render: `16:9-1080p`, `9:16-1080x1920`, `1:1-1080`.

⚠️ **No existe ejecutor de `calendar_entries`.** Verificado: la tabla se crea, lista, actualiza y borra desde `church-ops/calendar-routes.ts`, pero **ningún worker ni job la procesa**. Los estados `programado → publicando → publicado | fallido` se mueven hoy solo por acción manual vía API.

### 2.8 Infraestructura y despliegue

| Item | Valor verificado |
|---|---|
| VPS | `217.76.56.66`, Coolify, volumen `/data` |
| Servicios | `api`, `web`, `worker`, `redis` (`deploy/docker-compose.staging.yml`) |
| Web | nginx sirve la SPA en `:8080` y proxya `/api` → `api:3000` ([deploy/nginx.web.conf](deploy/nginx.web.conf)) — **mismo origen**, por eso la ausencia de CORS no se nota hoy |
| Fastify | `trustProxy: true` sin lista de proxies confiables ([app.ts:62](apps/api/src/app.ts#L62)) |
| Hardening | Headers de seguridad, `cache-control: no-store` global, rate limit en memoria por IP ([http/hardening.ts](apps/api/src/http/hardening.ts)) |
| CI/CD | `.github/workflows/`: `ci.yml`, `deploy-staging.yml`, `deploy-production.yml`, `setup-rclone-vps.yml` |
| Compose producción | Workflow usa `deploy/docker-compose.production.yml`; el `docker-compose.production.yml` de raíz apunta a `Dockerfile.*` en raíz, que no existen |
| Base de datos | Supabase, PostgreSQL 17, PostgREST v14.5, GoTrue v2.191.0 |

---

## 3. Estado real

### 3.1 Implementado y verificado en código

- Esquema de iglesia completo: 10 tablas, índices, triggers `updated_at`, búsqueda full-text en español, bootstrap de membresía del creador.
- RLS en las 10 tablas con matriz de permisos replicada en SQL.
- RBAC en la API con tabla de rutas auditable.
- DAM con archivos reales, versionado y streaming con `Range`.
- Producciones con comentarios y flujo de aprobaciones.
- Calendario declarativo y eventos en vivo con checklist e incidentes.
- Shell web de seis espacios.
- Insights por ministerio (`/church/insights`).

### 3.2 Incompleto o ausente

| Área | Estado real |
|---|---|
| **Control de OBS** | No existe (§2.6) |
| **Ejecutor de calendario** | No existe (§2.7) |
| **Publicación desde `productions`** | Los `publish_targets` se administran, pero no hay conector que publique una producción de iglesia; la publicación real sigue atada al pipeline legacy de episodios |
| **Visibilidad pública** | No existe en ninguna tabla |
| **Portal público / landing** | No existe en este repositorio; la landing actual vive fuera del repo (InfinityFree) |
| **`AutomationView`** | Maqueta |
| **DAM duplicado** | `digital-assets/` (legacy, JSON) y `church_assets` (Supabase) coexisten sin migración entre ambos |

### 3.3 Probado

- **32 archivos `*.test.ts` en `apps/api/test/`**, incluido `rbac.test.ts`, que asserta las 13 filas × 5 roles de la matriz y verifica que ninguna ruta mutante escape de la tabla de permisos.
- **29 archivos de test en `apps/web/test/`**.
- **Verificación local 2026-08-09:** `npm run typecheck` pasa; `npm run test` pasa con 64 archivos y 336 tests (`shared` 11, API 249, web 68, worker 8); `npm run build` pasa.
- **Avisos de build:** Vite reporta chunk principal >500 kB y un módulo (`apps/web/src/api.ts`) importado de forma estática y dinámica; no bloquea build.
- **Sin cobertura**: no hay tests de integración de `church-ops` contra PostgREST, ni tests de RLS en SQL. La corrección de las políticas está asegurada solo por revisión.
- Gates de CI (`ci.yml`): `npm ci` → typecheck → test → build sobre `main`, `staging`, `feature/**`.

### 3.4 Mock, demo o assisted

| Elemento | Naturaleza |
|---|---|
| `AutomationView` | Maqueta pura |
| Datos demo del dashboard legacy | Fallback silencioso si la API no responde (ver [AGENTS.md](AGENTS.md)) |
| Instagram / TikTok / X | `mode: 'assisted'` — la app prepara el paquete, publica una persona |
| `obs_profile` | Campo de texto sin efecto |

### 3.5 Staging y producción

- **Staging:** `https://creator-ai-studio.217.76.56.66.sslip.io`. ⚠️ `deploy-staging.yml` se dispara con push a la rama `staging`, **que ya no existe en el repositorio**. El despliegue de staging está, de hecho, huérfano.
- **Producción:** existe `deploy-production.yml` (push a `main` o dispatch manual) y apunta a `deploy/docker-compose.production.yml`, pero requiere app Coolify y secretos separados. **Sin dominio propio ni HTTPS con certificado válido: se sigue en `sslip.io`.** El `docker-compose.production.yml` de la raíz parece obsoleto porque referencia `Dockerfile.api`, `Dockerfile.web` y `Dockerfile.worker` en raíz, archivos que no existen.
- El código de iglesia (`fe52bc2`) está en `main`; **no consta despliegue verificado de este commit en ningún entorno**.

### 3.6 Deudas y riesgos confirmados

| # | Deuda / riesgo | Evidencia |
|---|---|---|
| D-1 | `cache-control: no-store` global impide cachear cualquier respuesta pública futura | [hardening.ts:86](apps/api/src/http/hardening.ts#L86) |
| D-2 | `trustProxy: true` sin proxies confiables → `X-Forwarded-For` falsificable; el rate limit por IP es evadible en cuanto exista una ruta pública sin auth | [app.ts:62](apps/api/src/app.ts#L62) + [hardening.ts:65-80](apps/api/src/http/hardening.ts#L65-L80) |
| D-3 | nginx impone `client_max_body_size 1m` mientras el DAM acepta 5 GB → subidas grandes fallan a través del proxy | [nginx.web.conf:28,40](deploy/nginx.web.conf#L28) vs `MAX_ASSET_BYTES` |
| D-4 | No hay CORS: cualquier consumidor fuera del origen de nginx falla | Sin `@fastify/cors` en dependencias |
| D-5 | Rate limit en memoria: no sobrevive reinicio ni escala horizontalmente | [hardening.ts:9-11](apps/api/src/http/hardening.ts#L9-L11) |
| D-6 | Dos DAM y dos módulos de calendario coexisten | `digital-assets/` + `church-ops/`; `calendar/` + `church-ops/calendar-routes.ts` |
| D-7 | Rama `staging` inexistente con workflow que la referencia | `git branch -a` + `deploy-staging.yml` |
| D-8 | Sin tests de RLS ni de integración PostgREST | `apps/api/test/` |
| D-9 | rclone: OAuth interactivo en VPS aún pendiente | [docs/02-operations/RCLONE_DRIVE.md](docs/02-operations/RCLONE_DRIVE.md) |
| D-10 | Compose de producción duplicado/obsoleto en raíz | `docker-compose.production.yml` referencia `Dockerfile.*` inexistentes; workflow usa `deploy/docker-compose.production.yml` |

---

## 4. Decisiones rectoras

Restricciones no negociables que filtran todo diseño:

| Restricción | Valor | Consecuencia |
|---|---|---|
| Desarrollo | **1 persona** (Ramiro + IA) | Sin microservicios nuevos; un módulo grande a la vez |
| Operación | **~5 personas** | 5 roles, sin flujos de aprobación multinivel |
| Infraestructura | **1 VPS** + Redis + Supabase | Sin S3 nuevo; el DAM usa `/data` + rclone |
| Transmisión | **OBS ya existe** en la iglesia | Cero ingesta RTMP propia; la plataforma observa y controla, no transmite |
| Legado | Pipeline YouTube funcionando | Se reencuadra, no se tira |

**Principio rector:** cada función debe ser usable por un voluntario que entró hace una semana, sin leer un manual.

**Principio de portal público (nuevo, 2026-08-06):** la landing es una **salida pública de la plataforma**, no otra aplicación administrativa. Solo consume contenido aprobado y marcado como público; nunca expone superficie de escritura, control operativo ni datos del equipo.

---

## 5. Próxima iniciativa oficial

**Church Public Portal V1** — 🔜 **Propuesto, no implementado.**

Capa mínima de lectura pública sobre `church-ops` que permita a la landing de la iglesia mostrar transmisión en vivo, próximos eventos y último sermón, publicados desde la app sin editar HTML.

Plan ejecutable: [docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md](docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md).

Fuera de alcance de V1: escrituras públicas (contacto, peticiones de oración, registro de visitas), CMS de textos, biblioteca pública, galería y control de OBS.

---

## 6. Bloqueadores

Ordenados por precedencia; los cuatro primeros bloquean el inicio de Church Public Portal V1.

| # | Bloqueador | Naturaleza |
|---|---|---|
| B-1 | **Dominio estable y HTTPS** — sigue en `sslip.io`; sin dominio y certificado válidos la landing no puede consumir la API sin mixed content | Infraestructura / decisión humana |
| B-2 | **Hosting público de la landing** — hoy InfinityFree, sin control de headers ni despliegue desde Git | Infraestructura / decisión humana |
| B-3 | **Identidad de iglesia para visitantes anónimos** — todas las tablas usan `church_id` y no hay usuario que la resuelva | Diseño |
| B-4 | **Acceso público a PostgREST/RLS** — no existe `GRANT` a `anon` ni vista pública; requiere diseño explícito antes de escribir código | Diseño / seguridad |
| B-5 | **CORS** — dependencia ausente; requerido para consumo cross-origin | Implementación |
| B-6 | **Caché** — `no-store` global debe exceptuarse para rutas públicas | Implementación |
| B-7 | **Proxies confiables y rate limiting** — `trustProxy: true` sin allowlist; **bloqueante antes de cualquier escritura pública**, no antes de V1 solo lectura | Seguridad |
| B-8 | Producción real en Coolify + rama de despliegue coherente | Operaciones |
| B-9 | E2E de staging con TTS y render reales | Operaciones |

---

## 7. Información obsoleta por el pivote

Se conserva el historial; se marca lo que dejó de ser válido.

| Afirmación previa | Estado |
|---|---|
| "Staging HEAD `staging` @ `0cee3a4`" (v1.0.0) | ❌ Obsoleto — la rama `staging` no existe; HEAD real es `main` @ `fe52bc2` |
| "14 agentes orquestados por Hermes como pipeline obligatorio" | ⚠️ Reencuadrado — el código sigue, el flujo obligatorio no |
| "Módulos UI: Home, Contenido, Proyectos, Workspace, Multicanal…" | ⚠️ Vigente solo como shell legacy; la shell activa de iglesia son los 6 espacios |
| "Control de OBS por obs-websocket v5" (AD-2 del plan técnico) | ❌ **No implementado** — es diseño, no estado |
| "Persistencia JSON en `/data` para las entidades nuevas" (§5 del plan técnico) | ❌ Superado — la implementación usa tablas Supabase con RLS |
| "Estimado ~90% hacia producción" | ❌ Obsoleto — la métrica medía el producto anterior |
| `docs/00-governance/ROADMAP.md` (fases 0–7) | ⚠️ Snapshot histórico pre-pivote |
| `docs/02-operations/STAGING_SNAPSHOT.md` | ⚠️ Snapshot histórico pre-pivote |

---

## 8. Documentos relacionados

| Doc | Rol |
|---|---|
| [docs/03-product/PLAN_IGLESIA_EQUIPO_DIGITAL.md](docs/03-product/PLAN_IGLESIA_EQUIPO_DIGITAL.md) | Visión del pivote (qué se quiere) |
| [docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md](docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md) | Plan técnico del pivote (qué se toca) — parcialmente ejecutado |
| [docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md](docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md) | Próximo incremento propuesto |
| [AGENTS.md](AGENTS.md) | Gotchas de desarrollo local (proxy `/api`, datos demo) |
| [docs/02-operations/SUPABASE_AUTH.md](docs/02-operations/SUPABASE_AUTH.md) | Auth y variables de despliegue |
| [docs/01-architecture/DEPLOYMENT_STAGING.md](docs/01-architecture/DEPLOYMENT_STAGING.md) | Despliegue staging |
| [docs/02-operations/RCLONE_DRIVE.md](docs/02-operations/RCLONE_DRIVE.md) | Archivado a Drive |
| [docs/02-operations/E2E_STAGING_CHECKLIST.md](docs/02-operations/E2E_STAGING_CHECKLIST.md) | Checklist E2E |

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial project state |
| 2026-07-05 | 0.2.0 | Cursor | Production Readiness baseline snapshot |
| 2026-07-05 | 0.3.0 | Cursor | Agent System v1 + CAS-HERMES-VAL |
| 2026-07-05 | 0.4.0 | Cursor | v1.1 agents, pipeline E2E |
| 2026-07-05 | 1.0.0 | Cursor | Sync with staging `0cee3a4`: 14 agents, Contenido, channels, rclone, deploy env |
| 2026-08-06 | 2.0.0 | Claude | Sincronización post-pivote contra `main` @ `fe52bc2`: identidad de plataforma de iglesia, módulos `church-ops`, RBAC+RLS, DAM real, corrección de OBS como no implementado, ejecutor de calendario ausente, deudas D-1…D-10, bloqueadores B-1…B-9, Church Public Portal V1 como próxima iniciativa |
| 2026-08-09 | 2.1.0 | Codex | Re-verificación contra HEAD real `fe52bc2`; working tree documental no limpio; gates locales `typecheck`, `test` y `build` en verde; deuda D-10 sobre compose de producción raíz; Church Public Portal V1 enlazado como plan propuesto |
