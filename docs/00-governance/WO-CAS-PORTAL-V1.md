## Document ID

WO-CAS-PORTAL-V1

## Title

Work Order — Church Public Portal V1 + Saneamiento de deudas técnicas previas

## Version

1.0.0

## Status

Active — ejecución

## Author

Codex (con autorización del PO)

## Created

2026-08-22

## Last Updated

2026-08-22

## Work Order relacionada

Apertura por instrucción directa del PO ("adelante con todo el desarrollo completo") sobre la base de `docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md` v1.1.0 y `PROJECT_STATE.md` v2.3.0.

## Purpose

Ejecutar la Fase 1 (modelo SQL público + tests RLS) y Fase 2 (API pública con CORS y caché) del plan del Church Public Portal V1, más cerrar las deudas técnicas D-3, D-5, D-7, D-9, D-10 que no requieren decisión humana adicional.

Fuera de alcance de esta Work Order (deben quedar como Work Orders independientes o esperar decisión humana):

- **B-1 / B-2 / B-3 / B-4** — dominio propio, hosting de la landing (Cloudflare Pages), `CHURCH_PUBLIC_SLUG`, política de `GRANT to anon` en producción. Estos puntos requieren decisión explícita del PO antes del deploy a producción.
- **Fase 3 (landing)** — repositorio separado fuera de este monorepo; requiere decisión de hosting.
- **Fase 5 (E2E navegador contra staging con dominio real)** — depende de Fase 3.
- **V1.1** — promoción de archivos a `/data/public/`, ministerios públicos, announcements, control OBS, ejecutor de calendario.

## Scope

### Dentro

1. **Fase 1 — Modelo SQL público** sobre el esquema actual de `church-ops`:
   - Campos ortogonales en `productions` y `live_events`: `visibility`, `show_on_landing`, `public_title`, `public_summary`, `watch_url`, `cover_asset_id`, `slug`, `expires_at`.
   - `publish_targets.platform` extendida con `'web'`.
   - Índices parciales sobre los predicados públicos.
   - Políticas RLS `to anon` con predicado completo de publicación.
   - `GRANT SELECT` por columna mínima a `anon`.
   - Vistas `security_invoker = on`: `public_live`, `public_events`, `public_latest_sermons`.
   - Espejo en `packages/shared` y JSON Schema de respuesta.

2. **Fase 1 — Tests SQL** verificables en CI o con script ejecutable: T-01…T-16 del plan.

3. **Fase 2 — Plugin público Fastify**:
   - `@fastify/cors` añadido como dependencia y registrado **solo dentro del plugin público**.
   - `anonClient()` en `church-ops/postgrest.ts` que envía la anon key sin token de usuario.
   - Tres endpoints `GET /api/public/{live,events,latest-sermon}` solo si `CHURCH_PUBLIC_SLUG` está definido.
   - Cabeceras `cache-control: public, max-age=...` (30 s / 60 s).
   - Una línea en la allowlist de autenticación (`/api/public/` con barra final obligatoria).
   - Tests de integración T-20…T-34.

4. **Deudas técnicas simultáneas (no bloquean V1)**:
   - **D-10**: eliminar `docker-compose.production.yml` obsoleto de la raíz que referencia `Dockerfile.*` inexistentes; documentar que el workflow usa `deploy/docker-compose.production.yml`.
   - **D-3**: subir `client_max_body_size` en `deploy/nginx.web.conf` para coincidir con `MAX_ASSET_BYTES` del DAM.
   - **D-5**: mover el rate limit de memoria a Redis (precondición fase futura de escrituras).
   - **D-7**: runbook de branch protection para GitHub (acción manual del owner).
   - **D-9**: runbook de OAuth interactivo de rclone en VPS.

5. **Fase 4 — Control interno mínimo** (sin Fase 3 visible): bloque "Sitio web" en `ProduccionesView` para marcar visibilidad pública y `watch_url`.

### Fuera

- Cualquier cambio a `main` o `staging` directo (solo PR).
- Decisión de dominio y hosting (B-1, B-2).
- Migración de la landing desde InfinityFree.
- Configuración de Supabase en producción con `CHURCH_PUBLIC_SLUG` real.
- Despliegue real a producción con dominio público (B-8).
- Conexión real a OBS (`obs-websocket-js` aún no se introduce; sigue como V1.1+).
- Ejecutor de `calendar_entries` (sigue pendiente, registrado en `PROJECT_STATE`).

## Ramas

- Base: `origin/staging` @ `1615c3e`
- Trabajo: `feature/codex/portal-v1`
- PR target: `staging`

Worktree operativo: `C:\Users\Ramiro Nuñez\worktrees\creator-ai-studio\portal-v1`

## Plan de ejecución

### Paso 1 — Worktree y Work Order

- [x] Crear worktree `feature/codex/portal-v1` desde `origin/staging`
- [x] Redactar Work Order (este documento)

### Paso 2 — Deudas técnicas sin dependencias

- [ ] D-10 compose obsoleto
- [ ] D-3 nginx client_max_body_size
- [ ] D-5 rate limit a Redis
- [ ] D-7 runbook branch protection
- [ ] D-9 runbook rclone OAuth

### Paso 3 — Fase 1 SQL

- [ ] Migración `supabase/migrations/<timestamp>_church_public_portal_v1.sql` con campos ortogonales, índices, políticas `to anon`, grants por columna y vistas `security_invoker`.
- [ ] Tests SQL T-01…T-16: script ejecutable por CI (pgTAP o `psql` + asserts).
- [ ] `packages/shared/src/church.ts`: extender `PublishPlatform`, `PLATFORM_DEFAULT_PRESET`, `AUTO_CAPABLE_PLATFORMS`. Añadir `ProductionVisibility` y tipos de respuesta pública.

### Paso 4 — Fase 2 API

- [ ] `apps/api/package.json`: añadir `@fastify/cors`.
- [ ] `apps/api/src/church-ops/postgrest.ts`: añadir `anonClient()`.
- [ ] `apps/api/src/public-portal/{plugin.ts,routes.ts,schemas.ts,views.ts}`: plugin público con tres endpoints.
- [ ] `apps/api/src/app.ts`: registrar el plugin solo si `CHURCH_PUBLIC_SLUG` está definido y bajo `/api`.
- [ ] `apps/api/src/auth/middleware.ts`: extender la allowlist con `/api/public/` (con barra final).
- [ ] Cabeceras de caché por endpoint.
- [ ] Variables de entorno nuevas (`CHURCH_PUBLIC_SLUG`, `PUBLIC_CORS_ORIGINS`, `PUBLIC_CACHE_TTL_LIVE`, `PUBLIC_CACHE_TTL_CONTENT`).
- [ ] Tests `apps/api/test/public-portal.test.ts` con T-20…T-34.

### Paso 5 — Fase 4 control interno

- [ ] `apps/web/src/church/views/ProduccionesView.tsx` (o componente nuevo): bloque "Sitio web" con `show_on_landing`, `public_title`, `public_summary`, `watch_url`, `published_at`, `cover_asset_id` (selector del DAM), slug autogenerado.
- [ ] Validación: solo activable con `status in ('aprobado','publicado')`.
- [ ] Auditoría: registrar el cambio como comentario del sistema en `production_comments`.
- [ ] `TargetsView` / UI de destinos: incluir `'web'` en la lista con `mode: 'auto'`.

### Paso 6 — Gates de calidad

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Validar JSON Schema de respuestas públicas
- [ ] Validar lint

### Paso 7 — Documentación y PR

- [ ] Actualizar `PROJECT_STATE.md` con el delta.
- [ ] Actualizar `CHANGELOG.md`.
- [ ] Actualizar `DOCUMENT_REGISTRY.md` y `MASTER_INDEX.md` si aplica.
- [ ] Runbook del operador.
- [ ] Preparar PR `feature/codex/portal-v1` → `staging`.

## Riesgos y rollback

| # | Riesgo | Mitigación / rollback |
|---|---|---|
| R-1 | Política `to anon` mal escrita expone contenido interno | Grants por columna como segunda barrera + tests T-07/T-08 |
| R-2 | Migración altera visibilidad de miembros autenticados | T-14 y T-15; las columnas son aditivas, `visibility` por defecto `'interna'` |
| R-3 | `CHURCH_PUBLIC_SLUG` ausente en producción | El plugin no se registra → todos los endpoints devuelven 404 |
| R-4 | `@fastify/cors` rompe alguna ruta interna existente | CORS se monta solo dentro del plugin público (encapsulación) |
| R-5 | Caché `public` filtra datos sensibles | Solo aplicado a rutas `/api/public/*`; tests T-27/T-28 verifican que `/church/*` mantiene `no-store` |
| R-6 | Rollback de migración con datos ya publicados | Columnas aditivas y anulables; revertir = `DROP VIEW` + `DROP POLICY` + `ALTER TABLE DROP COLUMN`, sin pérdida de datos |

## Decisiones humanas pendientes (no bloquean el código, bloquean el deploy)

1. **Dominio**: definir `landing.<iglesia>`, `api.<iglesia>`, `studio.<iglesia>`.
2. **Hosting**: aprobar Cloudflare Pages (recomendado) o Netlify para la landing.
3. **`CHURCH_PUBLIC_SLUG`**: slug definitivo de la iglesia.
4. **Permisos**: ¿productor debe poder publicar en la web o sigue siendo `admin` + `lider`?
5. **Título/resumen público**: ¿se obliga siempre o se permite heredar del interno?

## Validaciones a ejecutar antes de declarar listo

- `npm run typecheck` desde la raíz
- `npm run test` desde la raíz (al menos la nueva suite + `rbac.test.ts` sin cambios)
- `npm run build` desde la raíz
- Tests SQL: ejecutar el script de verificación contra una base staging
- Pruebas manuales con `curl` sin token contra los tres endpoints públicos
- Confirmación de que `/church/*` sigue respondiendo `no-store`
- Confirmación de que la allowlist no abre rutas vecinas (T-23/T-24)

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-08-22 | 1.0.0 | Codex | Apertura de la Work Order con autorización directa del PO. Scope: Fase 1 SQL + Fase 2 API + deudas técnicas D-3/D-5/D-7/D-9/D-10 + Fase 4 control interno mínimo. |
