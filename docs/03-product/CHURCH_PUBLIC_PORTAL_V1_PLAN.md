## Document ID

CHURCH_PUBLIC_PORTAL_V1_PLAN

## Title

Plan Técnico Ejecutable — Church Public Portal V1

## Version

1.1.0

## Status

Propuesto — no implementado

## Author

Claude + Ramiro + Codex

## Created

2026-08-09

## Last Updated

2026-08-06

## Baseline verificado

`main` @ **`fe52bc2`** — `feat: Implement initial church platform module`. Working tree al iniciar esta verificación: cambios documentales existentes (`M PROJECT_STATE.md`, `?? docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md`). PostgreSQL 17.6.1, PostgREST v14.5, GoTrue v2.191.0.

## Purpose

Diseñar la capa mínima que permite a la landing pública de la iglesia mostrar contenido gestionado en Creator AI Studio, sin exponer superficie administrativa, sin construir un CMS genérico y sin duplicar la máquina de estados existente.

## Scope

**Dentro:** modelo de visibilidad pública, vistas SQL para `anon`, API pública de solo lectura con tres endpoints, CORS, caché, control interno mínimo en Producciones, precondiciones de dominio y hosting.

**Fuera:** escrituras públicas (contacto, peticiones de oración, planes de visita), CMS de textos, biblioteca pública, galería, control de OBS, carga pública de archivos. La fase de escrituras es un incremento separado y posterior (§16, fase futura).

## Nota sobre ubicación

Se solicitó `docs/03-planning/`. Ese directorio no existe. El estándar real del repositorio es `docs/NN-categoria/`, y los planes de producto viven en `docs/03-product/` junto a `PLAN_TECNICO_PLATAFORMA_IGLESIA.md`. Este documento se ubica ahí por consistencia.

---

## 1. Hechos verificados que gobiernan el diseño

Cada decisión de este plan se apoya en una observación del código, no en documentos previos.

| # | Hecho | Evidencia | Consecuencia |
|---|---|---|---|
| H-1 | La API consulta PostgREST **con el token del usuario**; RLS es el enforcement real | [postgrest.ts:4-12](../../apps/api/src/church-ops/postgrest.ts#L4-L12), [middleware.ts:10-15](../../apps/api/src/auth/middleware.ts#L10-L15) | Un visitante sin token no puede usar el camino existente |
| H-2 | Todas las políticas RLS dependen de `auth.uid()` vía helpers privados `private.is_church_member()` / `private.church_can()` tras hardening | Migraciones `20260804120000` + `20260809180000` | `anon` (uid nulo) hoy **no ve absolutamente nada** |
| H-3 | No existe ningún `GRANT` a `anon` ni vista pública | `grep -niE "grant\|anon\|create view" supabase/migrations/` | Todo acceso público debe crearse explícitamente |
| H-4 | **No existe ejecutor de `calendar_entries`**: ningún worker ni job la procesa | `grep -rn "calendar_entries" apps workers packages` → solo `church-ops/*` | Programar vía calendario dejaría filas `programado` eternas |
| H-5 | `calendarCompliance` de `/church/insights` cuenta entradas no `publicado` como incumplimiento | [routes.ts:195-217](../../apps/api/src/church-ops/routes.ts#L195-L217) | Entradas huérfanas degradarían una métrica visible |
| H-6 | El `onSend` de hardening **respeta** un `cache-control` ya fijado por la ruta | [hardening.ts:86](../../apps/api/src/http/hardening.ts#L86) | La excepción de caché **no requiere modificar el hardening global** |
| H-7 | `trustProxy: true` sin allowlist de proxies | [app.ts:62](../../apps/api/src/app.ts#L62) | `X-Forwarded-For` es falsificable → rate limit evadible |
| H-8 | La allowlist de auth usa `startsWith` sobre prefijos | [middleware.ts:28-35](../../apps/api/src/auth/middleware.ts#L28-L35) | Un prefijo sin barra final abriría rutas vecinas |
| H-9 | `registerRoutePermissions` solo intercepta POST/PATCH/PUT/DELETE | [route-permissions.ts:193-197](../../apps/api/src/auth/route-permissions.ts#L193-L197) | Una API pública de solo GET no lo altera |
| H-10 | No hay `@fastify/cors` ni `zod` en dependencias | `apps/api/package.json` | CORS es dependencia nueva; validación con JSON Schema de Fastify |
| H-11 | `ministries` ya existe con `name, slug, description, lead_user_id, is_active` | Migración, líneas 37-49; [core-routes.ts](../../apps/api/src/church-ops/core-routes.ts) | Ministerios **no es entidad nueva** |
| H-12 | No hay integración OBS de ningún tipo | Sin `obs-websocket-js`; sin referencias en `apps/api/src` | El portal público no puede exponer estado real de OBS |
| H-13 | `live_events.status` es manual: `planeado \| preflight \| en_vivo \| finalizado` | Migración, líneas 137-153 | "Estamos en vivo" depende de que una persona cambie el estado |
| H-14 | nginx impone `client_max_body_size 1m` | [nginx.web.conf:28,40](../../deploy/nginx.web.conf#L28) | Irrelevante para V1 (solo GET), bloqueante para uploads grandes |
| H-15 | PostgreSQL 17 | `supabase/.temp/postgres-version` = 17.6.1 | `security_invoker` (PG15+) disponible |
| H-16 | Hay dos compose de producción | Workflow usa `deploy/docker-compose.production.yml`; el compose raíz referencia `Dockerfile.*` inexistentes | La promoción a producción debe usar el compose de `deploy/` o limpiar el duplicado antes del release |

---

## 2. Decisiones arquitectónicas

### AD-P1 — `platform = 'web'` se agrega; `calendar_entries` para web **no se usa en V1**

**Evaluación.** Reutilizar `publish_targets` y `calendar_entries` es correcto conceptualmente: evita una segunda máquina de estados y hace que "publicar en la web" sea el mismo gesto que publicar en YouTube. Pero H-4 y H-5 lo impiden hoy: **no hay quien mueva `programado → publicado`**. Crear entradas de calendario con destino web produciría filas que nunca transicionan, contaminarían "Hoy" (`upcomingPublications` filtra `status = 'programado'`) y hundirían `calendarCompliance` de forma permanente.

**Decisión:**

1. Se **agrega** `'web'` al CHECK de `publish_targets.platform` y a `PublishPlatform` en `packages/shared`. El destino "Sitio web" existe como concepto de primera clase, se administra en la pantalla de Destinos y su `mode` es `'auto'` (la web sí publica sin intervención humana, a diferencia de Instagram/TikTok).
2. **No se crean `calendar_entries` con destino web en V1.** La programación temporal se resuelve declarativamente: la vista pública filtra por `published_at <= now()`. Publicar con fecha futura equivale a programar, sin ejecutor y sin estados falsos.
3. Cuando exista un ejecutor de calendario (fuera de este plan), el destino web se enchufa a `calendar_entries` sin cambiar el modelo público: `published_at` seguirá siendo el criterio.

**No se crea ninguna máquina de estados nueva.** `productions.status` y `calendar_entries.status` conservan sus valores actuales en español.

### AD-P2 — Visibilidad como eje ortogonal, con valores en español

`status` responde "en qué punto del trabajo está". La visibilidad web responde "quién puede verlo". Son ejes independientes: una producción `publicado` en YouTube puede no ir a la web, y una `aprobado` puede publicarse en la web antes de subir a YouTube.

Los valores de enumeración del esquema están en español (`idea`, `grabacion`, `programado`, `fallido`…). Los nombres de columna están en inglés. Se mantiene esa convención: **columna en inglés, valores en español.**

```
visibility: 'interna' | 'equipo' | 'publica'   -- default 'interna'
```

### AD-P3 — Doble barrera: RLS para `anon` + vistas que limitan columnas

Se rechaza explícitamente consultar tablas internas con `service_role` y filtrar en TypeScript: eso convierte la seguridad en "espero no haber olvidado un `.eq()`" y contradice el principio ya establecido en el repositorio (H-1).

Diseño en tres capas, todas declarativas:

1. **Políticas RLS `to anon`** en las tablas base, con el predicado de publicación completo.
2. **`GRANT SELECT` por columna** a `anon` — columnas públicas y columnas mínimas usadas por el predicado. Con `security_invoker`, Postgres evalúa privilegios del invocador también sobre columnas usadas en `WHERE`; por eso `status`, `visibility`, `show_on_landing`, `published_at`, `expires_at` y `format` deben estar disponibles para que la vista pueda ejecutarse. No se otorgan columnas sensibles.
3. **Vistas `public_*` con `security_invoker = on`** (disponible por H-15) que reexponen solo esas columnas con el filtro repetido. Con `security_invoker = on` la vista se evalúa con los permisos del invocador, de modo que las políticas RLS del paso 1 siguen aplicando y no se produce el patrón "vista SECURITY DEFINER" que Supabase marca como riesgo.

La API pública usa un cliente PostgREST nuevo, `anonClient()`, que envía la anon key sin token de usuario. **No usa `serviceClient()` en ningún punto.**

**Decisión final para V1:** vistas `security_invoker`, no vistas normales y no RPC. Vistas normales creadas por `postgres` pueden saltarse RLS; RPC queda como alternativa solo si los tests demuestran que los grants de columnas mínimas exponen más metadatos de los aceptables.

### AD-P4 — Superficie pública montada una sola vez

Las rutas existentes se registran dos veces (prefijo `''` y `'/api'`). El plugin público se monta **solo bajo `/api/public/`**, para que exista una única superficie que auditar y una única entrada en la allowlist.

---

## 3. Modelo de datos

### 3.1 Campos nuevos en `productions`

Verificados contra el esquema actual (ninguno existe hoy):

```sql
alter table public.productions
  add column if not exists visibility text not null default 'interna'
    check (visibility in ('interna', 'equipo', 'publica')),
  add column if not exists show_on_landing boolean not null default false,
  add column if not exists slug text,
  add column if not exists public_title text,
  add column if not exists public_summary text,
  add column if not exists cover_asset_id uuid references public.church_assets (id) on delete set null,
  add column if not exists watch_url text,
  add column if not exists expires_at timestamptz;

-- published_at ya existe (timestamptz, nullable). No se toca.
alter table public.productions
  add constraint productions_slug_unique unique (church_id, slug);
```

Notas de diseño:

- `public_title` / `public_summary` permiten que el título interno ("Sermón 12 — revisar audio min 4") difiera del público. Si son nulos, la vista cae a `title` / `summary`.
- `watch_url` es el enlace de YouTube/Facebook del sermón. **Es el mecanismo por el que el video no se sirve desde el VPS** (§10). Sin `watch_url` ni `cover_asset_id`, una producción no es publicable en la web.
- No se agrega `sort_order` a `productions`: el orden público es cronológico (`published_at desc`). Solo `ministries` lo necesita (§11).

### 3.2 Campos nuevos en `live_events`

```sql
alter table public.live_events
  add column if not exists visibility text not null default 'interna'
    check (visibility in ('interna', 'equipo', 'publica')),
  add column if not exists show_on_landing boolean not null default false,
  add column if not exists public_title text,
  add column if not exists watch_url text,
  add column if not exists cover_asset_id uuid references public.church_assets (id) on delete set null;
```

`live_events` no lleva `published_at`: su eje temporal es `scheduled_at`, que ya existe. El estado en vivo se deriva de `status = 'en_vivo'` (H-13: lo cambia una persona; el portal no puede inventar detección automática sin integración de plataforma).

### 3.3 `publish_targets`

```sql
alter table public.publish_targets drop constraint if exists publish_targets_platform_check;
alter table public.publish_targets add constraint publish_targets_platform_check
  check (platform in ('youtube', 'facebook', 'instagram', 'tiktok', 'x', 'web'));
```

Espejo en `packages/shared/src/church.ts`: `PublishPlatform`, `PLATFORM_DEFAULT_PRESET` (`web: '16:9-1080p'`) y `AUTO_CAPABLE_PLATFORMS` (agregar `'web'`).

### 3.4 Índices

```sql
create index if not exists idx_productions_public
  on public.productions (church_id, published_at desc)
  where show_on_landing and visibility = 'publica' and status = 'publicado';

create index if not exists idx_live_events_public
  on public.live_events (church_id, scheduled_at)
  where show_on_landing and visibility = 'publica';
```

---

## 4. Seguridad de base de datos

### 4.1 Predicado de publicación (fuente de verdad única)

Un contenido es público **si y solo si** cumple todo:

| Condición | `productions` | `live_events` |
|---|---|---|
| Pertenece a la iglesia pública | `church_id = (slug configurado)` | ídem |
| Marcado para la web | `show_on_landing = true` | `show_on_landing = true` |
| Visibilidad | `visibility = 'publica'` | `visibility = 'publica'` |
| Estado del trabajo | `status = 'publicado'` | `status in ('planeado','preflight','en_vivo')` |
| Ventana temporal | `published_at is not null and published_at <= now()` | `scheduled_at >= now() - interval '4 hours'` |
| No expirado | `expires_at is null or expires_at > now()` | — |

### 4.2 Políticas RLS para `anon`

```sql
create policy productions_public_select on public.productions for select to anon
  using (
    show_on_landing
    and visibility = 'publica'
    and status = 'publicado'
    and published_at is not null
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

create policy live_events_public_select on public.live_events for select to anon
  using (
    show_on_landing
    and visibility = 'publica'
    and status in ('planeado', 'preflight', 'en_vivo')
    and scheduled_at >= now() - interval '4 hours'
  );

create policy churches_public_select on public.churches for select to anon
  using (true);   -- solo nombre, slug, timezone y locale se otorgan por columna
```

Las políticas existentes usan `for select using (is_church_member(...))` **sin cláusula `to`**, es decir aplican a todos los roles. Postgres combina políticas del mismo comando con `OR`, así que las nuevas políticas `to anon` **amplían** el acceso solo para el rol `anon` sin alterar el comportamiento de `authenticated`. Debe verificarse en test que un miembro autenticado no gana ni pierde visibilidad.

### 4.3 Grants por columna

```sql
grant select (id, church_id, title, public_title, public_summary, format,
              status, visibility, show_on_landing,
              service_date, preacher, bible_ref, slug, cover_asset_id,
              watch_url, published_at, expires_at, ministry_id)
  on public.productions to anon;

grant select (id, church_id, title, public_title, scheduled_at, status,
              visibility, show_on_landing, watch_url, cover_asset_id)
  on public.live_events to anon;

grant select (id, name, slug, timezone, locale) on public.churches to anon;
```

**Nunca otorgadas a `anon`:** `script`, `assigned_to`, `created_by`, `summary` interno, `legacy_episode_id`, `source_asset_ids`, `created_at`, `updated_at`, `crew`, `checklist`, `incidents`, `obs_profile`, `recording_asset_id`, `target_ids`.

**Tablas sin ningún grant a `anon`:** `church_members`, `church_assets`, `production_comments`, `production_approvals`, `publish_targets`, `calendar_entries`, `ministries` (hasta V1.1), `profiles`.

Los grants sobre columnas de predicado no significan que la API pública las devuelva. Las respuestas contractuales de `/api/public/*` salen solo de las vistas y del mapper público. Los tests deben cubrir tanto el contrato HTTP como intentos directos de PostgREST contra columnas internas.

### 4.4 Vistas públicas

```sql
create or replace view public.public_live
  with (security_invoker = on) as
select
  le.id,
  coalesce(le.public_title, le.title) as title,
  le.scheduled_at,
  le.status,
  le.watch_url,
  c.slug as church_slug
from public.live_events le
join public.churches c on c.id = le.church_id
where le.show_on_landing
  and le.visibility = 'publica'
  and le.status in ('planeado', 'preflight', 'en_vivo')
  and le.scheduled_at >= now() - interval '4 hours';

create or replace view public.public_events with (security_invoker = on) as
select le.id, coalesce(le.public_title, le.title) as title,
       le.scheduled_at, le.status, le.watch_url, c.slug as church_slug
from public.live_events le
join public.churches c on c.id = le.church_id
where le.show_on_landing and le.visibility = 'publica'
  and le.status in ('planeado', 'preflight')
  and le.scheduled_at >= now();

create or replace view public.public_latest_sermons with (security_invoker = on) as
select p.id,
       coalesce(p.public_title, p.title) as title,
       p.public_summary as summary,
       p.slug, p.preacher, p.bible_ref, p.service_date,
       p.published_at, p.watch_url, p.cover_asset_id,
       c.slug as church_slug
from public.productions p
join public.churches c on c.id = p.church_id
where p.show_on_landing and p.visibility = 'publica'
  and p.status = 'publicado'
  and p.published_at is not null and p.published_at <= now()
  and (p.expires_at is null or p.expires_at > now())
  and p.format = 'sermon'
order by p.published_at desc;

grant select on public.public_live, public.public_events,
                public.public_latest_sermons to anon;
```

`public_ministries` se define en V1.1 (§11), con la misma forma.

**Por qué `security_invoker = on`:** la vista no otorga privilegios propios; las políticas de §4.2 y los grants de §4.3 siguen evaluándose contra `anon`. Si mañana alguien borra una política, la vista deja de devolver datos en lugar de seguir sirviéndolos.

**Sin escrituras:** las vistas son de solo lectura por construcción (contienen `join`), y no se crean reglas ni triggers `instead of`. No se otorga `insert`, `update` ni `delete` a `anon` en ninguna tabla o vista.

---

## 5. Resolución de iglesia

### Opciones evaluadas

| Opción | Ventaja | Coste | Riesgo |
|---|---|---|---|
| **A. `CHURCH_PUBLIC_SLUG` por entorno** | Ninguna ruta acepta identificador del cliente; imposible enumerar iglesias | Un despliegue por iglesia | Ninguno mientras haya una iglesia |
| B. `/api/public/:churchSlug/...` | Multi-iglesia en un despliegue | Cada endpoint acepta entrada del visitante; superficie de enumeración; hay que validar el slug en cada ruta | Un fallo de validación cruza iglesias |

### Decisión: opción A para V1

`CHURCH_PUBLIC_SLUG` se lee del entorno al arrancar y se resuelve **una vez** a `church_id`, cacheado en memoria. Si la variable no está definida, **el plugin público no se registra**: el portal simplemente no existe, en lugar de servir la primera iglesia que encuentre.

Cómo evita ambigüedad y fuga entre iglesias:

- El visitante nunca envía identificador de iglesia; no hay parámetro que manipular.
- Las vistas exponen `church_slug` para que la landing pueda verificar, pero el filtro server-side es por `church_id` resuelto internamente.
- Migrar a la opción B más adelante no rompe la landing: los endpoints mantienen su forma; solo se agrega un segmento de ruta.

---

## 6. API pública V1

### 6.1 Endpoints (solo lectura)

| Método | Ruta | Origen | TTL |
|---|---|---|---|
| GET | `/api/public/live` | `public_live`, primer registro | 30 s |
| GET | `/api/public/events` | `public_events`, `limit` 1-10 (def. 3) | 60 s |
| GET | `/api/public/latest-sermon` | `public_latest_sermons`, primer registro | 60 s |

Forma de respuesta (contrato estable, sin campos internos):

```jsonc
// GET /api/public/live  — sin transmisión próxima
{ "status": "offline", "next": null }

// GET /api/public/live  — en vivo
{ "status": "live",
  "title": "Culto dominical",
  "watchUrl": "https://www.youtube.com/watch?v=...",
  "scheduledAt": "2026-08-09T10:00:00-07:00" }

// GET /api/public/live  — programada
{ "status": "scheduled",
  "next": { "title": "Culto dominical", "scheduledAt": "...", "watchUrl": null } }

// GET /api/public/events
{ "items": [ { "id": "...", "title": "...", "scheduledAt": "...", "watchUrl": null } ] }

// GET /api/public/latest-sermon
{ "sermon": { "id": "...", "title": "...", "summary": "...", "slug": "...",
              "preacher": "...", "bibleRef": "...", "serviceDate": "2026-08-02",
              "publishedAt": "...", "watchUrl": "...", "coverUrl": null } }
```

`coverUrl` es `null` en V1: servir miniaturas públicas requiere el almacenamiento separado de §10, que es V1.1. La landing debe tolerar `null` (§16, Fase 3).

### 6.2 Aislamiento

Estructura propuesta: `apps/api/src/public-portal/` con `plugin.ts`, `views.ts` (consultas a las vistas), `schemas.ts` (JSON Schema de respuesta). **No importa nada de `church-ops/` salvo el cliente PostgREST**, para que una refactorización de rutas internas no arrastre la superficie pública.

Registro en `app.ts`: **una sola vez**, con prefijo `/api`, y solo si `CHURCH_PUBLIC_SLUG` está definido.

### 6.3 Cambio exacto en la allowlist de autenticación

Un único cambio en [middleware.ts:28](../../apps/api/src/auth/middleware.ts#L28):

```ts
const PUBLIC_PATH_PREFIXES = ['/oauth/', '/api/oauth/', '/api/public/'];
```

**La barra final es obligatoria** (H-8): con `'/api/public'` el `startsWith` abriría también `/api/publicaciones`, `/api/public-targets` o cualquier ruta futura con ese prefijo textual. La matriz de pruebas de §17 lo verifica explícitamente.

No se modifica `route-permissions.ts`: V1 no expone métodos mutantes y el hook solo intercepta POST/PATCH/PUT/DELETE (H-9).

---

## 7. CORS

Dependencia nueva: `@fastify/cors` (H-10).

**Ámbito:** registrado **dentro del plugin público**, no en la instancia raíz. Los plugins de Fastify encapsulan por defecto, así que el resto de la API conserva su comportamiento actual (sin CORS, mismo origen).

```ts
// dentro del plugin público
await instance.register(cors, {
  origin: resolveAllowedOrigins(),      // lista explícita desde env
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['content-type'],
  credentials: false,                    // el portal nunca envía cookies ni Authorization
  maxAge: 86400,
});
```

| Entorno | `PUBLIC_CORS_ORIGINS` | Comportamiento |
|---|---|---|
| Desarrollo | vacío → `http://localhost:5173`, `http://127.0.0.1:5173` | Permisivo pero explícito; nunca `*` |
| Staging | dominio de la landing de staging | Lista explícita |
| Producción | dominio(s) de la landing | **Lista explícita. Si la variable está vacía en producción, el arranque falla**, igual que el fail-closed de autenticación ([middleware.ts:51-58](../../apps/api/src/auth/middleware.ts#L51-L58)) |

Sin wildcard en ningún entorno. `credentials: false` es deliberado: si algún día el portal necesitara credenciales, el cambio debe ser una decisión consciente y no un default heredado.

---

## 8. Caché

**No requiere modificar el hardening global** (H-6): el `onSend` aplica `no-store` solo si la ruta no fijó ya un `cache-control`.

| Endpoint | Cabecera |
|---|---|
| `/api/public/live` | `public, max-age=30` |
| `/api/public/events` | `public, max-age=60` |
| `/api/public/latest-sermon` | `public, max-age=60` |

`s-maxage` y `stale-while-revalidate` solo se agregan cuando el hosting/CDN elegido realmente los soporte y la ruta de la API pase por ese CDN. Con Cloudflare delante de la API, la forma ampliada propuesta es `public, max-age=60, s-maxage=300, stale-while-revalidate=600` para eventos y sermones. Si la API queda directa al VPS, se mantiene solo `max-age`.

TTL de 30 s para `live`: el estado lo cambia una persona (H-13) y el retraso máximo aceptable al iniciar un culto es medio minuto. Un TTL menor multiplica peticiones sin ganancia real.

**Prohibido:** ninguna respuesta autenticada puede llevar `cache-control: public`. Los tests de §17 verifican que las rutas `/church/*` siguen respondiendo `no-store`.

---

## 9. Proxy y rate limiting

**Estado (H-7):** `trustProxy: true` sin allowlist. nginx compone `X-Forwarded-For` con `$proxy_add_x_forwarded_for`, que **añade** la IP real al valor recibido del cliente; con `trustProxy: true` Fastify toma el extremo controlable por el cliente. Un atacante puede rotar `X-Forwarded-For` y evadir el limitador por IP de `hardening.ts`.

**Impacto en V1:** bajo. Los tres endpoints son GET cacheados, sin coste de escritura y sin efectos secundarios. El límite general (600 req/min) sigue aplicando de forma imperfecta.

**Bloqueante para la fase de escrituras.** Antes de exponer `POST /api/public/*` hay que:

1. Fijar `trustProxy` a la lista real de proxies (red Docker de Coolify, IP del proxy, y rangos de Cloudflare si se usa su CDN) en lugar de `true`.
2. Documentar de dónde sale la IP del cliente en cada salto: navegador → Cloudflare → Traefik/Coolify → nginx → Fastify.
3. Añadir tests que envíen `X-Forwarded-For` falsificado desde una IP no confiable y verifiquen que **no** altera la IP contabilizada.
4. Evaluar mover el limitador a Redis, ya disponible como servicio (D-5 de PROJECT_STATE).

Este plan **no** ejecuta esos cuatro puntos; los deja como precondición registrada de la fase futura.

---

## 10. Archivos, imágenes y video

| Contenido | Origen público | Justificación |
|---|---|---|
| Sermón completo | **YouTube/Facebook embed vía `watch_url`** | El VPS no puede sostener video congregacional; ya existe OAuth de YouTube |
| Miniatura / portada | `/data/public/` (V1.1) | Tráfico pequeño y cacheable |
| PDF, audio liviano | `/data/public/` (V1.1) | Idem |
| Cualquier asset del DAM | **Nunca directo** | El DAM contiene material sin editar, interno y personal |

**Separación física, no filtrado por metadatos.** La ruta existente `/church/assets/:id/file` seguirá siendo autenticada, sin variante pública. Los archivos que se publiquen se **promueven** por copia a `/data/public/<church>/<yyyy>/<mm>/<hash>.<ext>`, servidos por una ruta pública o por nginx sobre ese directorio.

Razón: si el acceso público filtrara por metadatos sobre `/data/assets/`, un error en un `where` expondría el DAM completo. Con separación física, un archivo no promovido es inalcanzable aunque la consulta falle.

En V1 `coverUrl` viaja como `null` y la landing usa su propia imagen por defecto. La promoción de archivos entra en V1.1.

---

## 11. Ministerios (verificado: ya existe)

`ministries` existe desde `fe52bc2` (H-11): tabla con RLS, rutas `/church/ministries[/:id]`, tipo `Ministry` en `packages/shared`, y UI. **No se presenta como entidad nueva.**

Campos que realmente faltan para uso público:

| Campo | Tipo | Para qué |
|---|---|---|
| `image_asset_id` | `uuid → church_assets` | Foto del ministerio |
| `schedule` | `text` | "Viernes 7:00 PM" |
| `audience` | `text` | "Jóvenes 13-25" |
| `sort_order` | `integer not null default 0` | Orden en la landing |
| `visibility` / `show_on_landing` | igual que §3 | Coherencia del predicado |
| `public_contact` | `text` | Contacto público (no el email del líder) |

**Ubicación: V1.1, no V1.** Es barato (una migración, una vista, un endpoint) precisamente porque el dominio ya existe, pero depende de `image_asset_id` → promoción de archivos (§10), que también es V1.1. Agruparlos evita dos despliegues.

---

## 12. Announcements (única entidad nueva)

`calendar_entries` **no** cubre su semántica: exige `production_id` o `live_event_id` (constraint `calendar_entry_has_subject`) y `target_id` obligatorio hacia una plataforma. Un aviso no tiene producción, ni destino, ni render. Forzarlo ahí requeriría producciones y destinos ficticios.

**Tabla propia propuesta:**

```sql
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'importante', 'urgente')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  action_label text,
  action_url text,
  is_active boolean not null default true,
  visibility text not null default 'interna' check (visibility in ('interna','equipo','publica')),
  show_on_landing boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Permiso de escritura: `production.publish` (un aviso es comunicación pública, no edición). Trigger `updated_at` como el resto.

**Decisión: fuera del primer corte.** V1 son tres endpoints de solo lectura sobre dominios existentes; announcements suma migración, rutas internas, UI y permisos. Entra en **V1.1** junto con ministerios y promoción de archivos. La expiración automática (`expires_at`) es su razón de ser y ya está contemplada en el diseño.

---

## 13. Hosting de la landing

Reverificado el 2026-08-09 contra documentación pública: Cloudflare Pages mantiene Git integration, custom domains, `_headers` y rollbacks; Netlify mantiene capacidades equivalentes; InfinityFree ofrece dominio propio y SSL, pero el despliegue automatizado desde Git no es nativo y el camino documentado sigue siendo FTP/manual o automatización externa por FTP.

| Opción | Dominio propio | HTTPS | Caché de borde | Headers | Deploy desde Git | Rollback | Veredicto |
|---|---|---|---|---|---|---|---|
| **Cloudflare Pages** | Sí | Automático | Sí, global | `_headers` completo | Sí | Sí, por versión | ✅ **Recomendado** |
| Netlify | Sí | Automático | Sí | `_headers` | Sí | Sí | Alternativa válida |
| InfinityFree | Limitado | Variable | No | No configurables | No (FTP) | No | ❌ Descartado |

**Recomendación: Cloudflare Pages.** Motivos técnicos concretos, no preferencia:

1. `s-maxage` y `stale-while-revalidate` del §8 solo rinden con CDN.
2. Control de headers necesario para CSP y para no romper el consumo de la API.
3. Despliegue desde Git y rollback por versión: sin ellos, un error en la landing pública se arregla por FTP a mano.
4. InfinityFree puede interponer interstitials anti-bot que rompen `fetch()` desde la propia página.
5. Si la landing se sirviera desde Cloudflare y la API tras el mismo proxy, se abre la opción futura de eliminar CORS por completo con un mismo origen.

**La migración de hosting es parte del bloqueador inicial (Fase 0), no una mejora futura.** Construir el portal contra InfinityFree implicaría rehacer caché y headers después.

---

## 14. Dominio (precondición dura)

Antes de escribir código:

1. Definir dominio público de la iglesia (p. ej. `<iglesia>.tld`).
2. Definir dominio estable de la API (p. ej. `api.<iglesia>.tld`) y del panel interno (`studio.<iglesia>.tld`).
3. Configurar DNS: landing → hosting elegido; `api` y `studio` → VPS.
4. Emitir certificados (Let's Encrypt vía Coolify/Traefik) y **retirar `sslip.io`** del `server_name` de nginx.
5. Confirmar HTTPS extremo a extremo: `curl -I https://api.<dominio>/api/health` con certificado válido.
6. Confirmar que la landing HTTPS consume la API sin mixed content ni error de certificado.

Sin esto, el navegador bloqueará las llamadas y ninguna cantidad de código lo arregla.

---

## 15. Interfaz interna

**No se crea un espacio "Landing CMS".** El gesto vive donde vive el contenido: en Producciones.

Control mínimo en el detalle de producción (`apps/web/src/church/views/ProductionsView.tsx`):

```
┌─ Sitio web ─────────────────────────────────┐
│ [x] Mostrar en la web                        │
│ Título público   [ La gracia que transforma ]│
│ Resumen público  [ ...                     ] │
│ Enlace del video [ https://youtu.be/...    ] │
│ Portada          [ elegir de la biblioteca ] │
│ Dirección web    /mensajes/la-gracia-que...  │
│ Publicar el      [ 2026-08-09 ] [ 10:30 ]    │
│                                              │
│ ✓ Visible en el sitio desde el 9 de agosto   │
└──────────────────────────────────────────────┘
```

| Aspecto | Definición |
|---|---|
| **Permiso RBAC** | `production.publish` (`admin`, `lider`). Es publicación, no edición: el mismo permiso que exige publicar en YouTube |
| **Validación de estado** | Solo activable con `status in ('aprobado','publicado')`. Con estado anterior, el control aparece deshabilitado con el motivo escrito |
| **Campos requeridos** | `watch_url` **o** `cover_asset_id`; `public_title` (por defecto `title`); `published_at` |
| **Slug** | Autogenerado desde el título con `slugify` (ya existe en [core-routes.ts:34](../../apps/api/src/church-ops/core-routes.ts#L34)), editable, único por iglesia |
| **Fecha pública** | `published_at`; futura = programado (aparece solo al llegar la fecha, AD-P1) |
| **Indicación** | Una línea en lenguaje llano: "Visible en el sitio desde el 9 de agosto" / "No visible" |
| **Auditoría** | El cambio se registra como comentario del sistema en `production_comments` (tabla ya existente), sin infraestructura nueva |

En V1 el control editorial explícito vive en Producciones. "En Vivo" no recibe un espacio ni bloque CMS adicional: `/api/public/live` usa `live_events.status`, `scheduled_at` y los campos públicos mínimos agregados por el modelo. Una UI equivalente para marcar eventos en vivo como visibles queda para V1.1 si el piloto la necesita.

---

## 16. Fases

### FASE 0 — Precondiciones (sin código de aplicación)

**Entrada:** decisión humana sobre dominio y hosting (§21).
**Trabajo:** dominio y DNS; certificados; retirar `sslip.io`; migrar la landing a Cloudflare Pages con su repositorio propio; definir `CHURCH_PUBLIC_SLUG`; crear la iglesia real en la base si aún no existe.
**Salida:** `https://<landing>` y `https://api.<dominio>/api/health` responden con certificado válido; la landing despliega desde Git con rollback; la iglesia existe y su slug está fijado.

### FASE 1 — Modelo público de solo lectura (SQL)

**Entrada:** Fase 0 completa.
**Trabajo:** migración con campos ortogonales (§3.1, §3.2), `platform='web'` (§3.3), índices (§3.4), políticas `to anon` (§4.2), grants por columna (§4.3), vistas (§4.4). Espejo de tipos en `packages/shared`.
**Salida:** con la anon key y sin sesión, `select` sobre las tres vistas devuelve **solo** contenido publicado; `select` directo sobre `church_assets`, `church_members`, `production_comments`, `calendar_entries` y `profiles` devuelve error de permisos; un miembro autenticado conserva exactamente la visibilidad previa. Todo demostrado por los tests SQL de §17.

### FASE 2 — API pública

**Entrada:** Fase 1 desplegada en staging.
**Trabajo:** `apps/api/src/public-portal/`; `anonClient()` en `postgrest.ts`; los tres endpoints; `@fastify/cors` en el scope del plugin; cabeceras de caché; una línea en la allowlist; registro condicionado a `CHURCH_PUBLIC_SLUG`.
**Salida:** los tres endpoints responden sin `Authorization`; preflight OPTIONS correcto desde el origen permitido y rechazado desde otro; cabeceras de caché correctas; `typecheck`, `test` y `build` en verde; suite de §17 completa.

### FASE 3 — Integración en la landing

**Entrada:** Fase 2 en staging con dominio real.
**Trabajo:** tres bloques (en vivo, próximos eventos, último sermón) consumiendo los endpoints; estados de carga, error y vacío; embed de YouTube desde `watch_url`; tolerancia a `coverUrl: null`.
**Salida:** la landing muestra datos reales; con la API caída muestra **contenido estático honesto** (horario fijo del culto y enlace al canal), nunca datos demo inventados — el fallback silencioso a datos falsos ya causó confusión en el dashboard interno ([AGENTS.md](../../AGENTS.md)) y no se repite de cara al público.

### FASE 4 — Control interno

**Entrada:** Fase 3 funcionando con datos sembrados a mano.
**Trabajo:** bloque "Sitio web" en Producciones (§15); destino `web` en la pantalla de Destinos; permisos; auditoría en `production_comments`; reflejo en "Hoy" de lo publicado en web. Para `live_events`, mantener solo el uso de estado/horario/visibilidad mínima sin crear un CMS paralelo.
**Salida:** un `lider` publica un sermón en la web sin tocar SQL ni HTML; un `productor` ve el control deshabilitado con el motivo; el contenido aparece en la landing dentro del TTL de caché.

### FASE 5 — Hardening y release

**Entrada:** Fases 1-4 en staging.
**Trabajo:** revisión de seguridad de la superficie pública; E2E navegador real contra staging; logs de acceso público separados; métricas mínimas (peticiones y aciertos de caché por endpoint); runbook de "el portal muestra datos incorrectos"; procedimiento de rollback (revertir migración y desregistrar el plugin); validación en staging con la iglesia real.
**Salida:** criterios de producción cumplidos: sin datos internos en respuestas públicas, sin regresión en rutas autenticadas, rollback probado, runbook escrito.

### FASE FUTURA (separada) — Escrituras públicas

**No forma parte de Church Public Portal V1.** Requiere, como precondiciones: §9 completo (proxies confiables, rate limiting verificado contra spoofing, limitador en Redis), decisión de retención y privacidad de peticiones de oración, rol de acceso definido, RLS restrictiva desde el primer día, honeypot y CAPTCHA solo si aparece spam real, y confirmación explícita de que ninguna ruta pública devuelve el contenido de las peticiones.

---

## 17. Matriz de pruebas

### 17.1 SQL / RLS (nuevo: `supabase/tests/` o script verificable en CI)

| # | Prueba | Resultado esperado |
|---|---|---|
| T-01 | `anon` consulta `public_latest_sermons` con un sermón publicado | Devuelve la fila |
| T-02 | Producción con `status='revision'`, `show_on_landing=true` | **No** aparece |
| T-03 | Producción `publicado` con `show_on_landing=false` | **No** aparece |
| T-04 | Producción `publicado`, `visibility='equipo'` | **No** aparece |
| T-05 | Producción con `published_at` en el futuro | **No** aparece hasta la fecha |
| T-06 | Producción con `expires_at` pasado | **No** aparece |
| T-07 | `anon` intenta `select script from productions` | Error de permisos (columna no otorgada) |
| T-08 | `anon` intenta `select assigned_to, created_by from productions` | Error de permisos |
| T-09 | `anon` consulta `church_assets` | Cero filas / permiso denegado |
| T-10 | `anon` consulta `church_members`, `profiles` | Cero filas / permiso denegado |
| T-11 | `anon` consulta `production_comments`, `production_approvals` | Cero filas / permiso denegado |
| T-12 | `anon` consulta `calendar_entries`, `publish_targets` | Cero filas / permiso denegado |
| T-13 | `anon` intenta `insert`/`update`/`delete` en cualquier tabla o vista | Denegado |
| T-14 | Miembro `voluntario` autenticado consulta `productions` | Ve exactamente lo mismo que antes de la migración |
| T-15 | Miembro de la iglesia A consulta contenido público de la iglesia B | No lo ve (aislamiento por `church_id` intacto) |
| T-16 | `live_events` en `en_vivo` con `show_on_landing` | Aparece en `public_live` sin `crew`, `checklist`, `incidents` ni `obs_profile` |

### 17.2 Integración de API (`apps/api/test/public-portal.test.ts`)

| # | Prueba | Resultado esperado |
|---|---|---|
| T-20 | `GET /api/public/live` sin `Authorization` | 200 |
| T-21 | `GET /api/public/events`, `GET /api/public/latest-sermon` sin auth | 200 |
| T-22 | `GET /api/church/productions` sin auth | 401 |
| T-23 | `GET /api/public` (sin barra) | 401 o 404, **nunca** 200 |
| T-24 | `GET /api/publicaciones`, `GET /api/public-targets` sin auth | 401 — el prefijo no abre rutas vecinas |
| T-25 | `POST /api/public/live` | 404/405, nunca aceptado |
| T-26 | Respuesta pública contiene solo campos del contrato §6.1 | Sin `script`, `assignedTo`, `createdBy`, `churchId` interno |
| T-27 | Cabecera de caché en `/api/public/live` | `public, max-age=30` |
| T-27b | Cabecera de caché en `/api/public/events` y `/api/public/latest-sermon` | `public, max-age=60` salvo variante CDN explícitamente habilitada |
| T-28 | Cabecera de caché en una ruta `/church/*` autenticada | Sigue siendo `no-store` |
| T-29 | Preflight OPTIONS desde origen permitido | 204 con `access-control-allow-origin` correcto |
| T-30 | Preflight desde origen no permitido | Sin cabecera de permiso |
| T-31 | `POST` u `OPTIONS` con método no listado | Rechazado por CORS |
| T-32 | Suite `rbac.test.ts` completa | Pasa sin cambios — ninguna ruta administrativa quedó abierta |
| T-33 | Sin `CHURCH_PUBLIC_SLUG` | El plugin no se registra; los tres endpoints devuelven 404 |
| T-34 | `PUBLIC_CORS_ORIGINS` vacío con `NODE_ENV=production` | El arranque falla con mensaje explícito |

### 17.3 E2E (Fase 5, Playwright contra staging)

| # | Prueba | Resultado esperado |
|---|---|---|
| T-40 | Publicar un sermón desde la app y verlo en la landing | Aparece tras expirar el TTL |
| T-41 | Marcar un evento como `en_vivo` | La landing muestra el bloque "Estamos en vivo" en ≤ 30 s |
| T-42 | API caída | La landing muestra el fallback estático, sin datos inventados |
| T-43 | Producción despublicada (`show_on_landing=false`) | Desaparece de la landing |

---

## 18. Variables de entorno propuestas

| Variable | Ámbito | Valor por defecto | Descripción |
|---|---|---|---|
| `CHURCH_PUBLIC_SLUG` | API | *(sin valor)* | Slug de la iglesia que publica. **Sin ella el portal público no se registra.** |
| `PUBLIC_CORS_ORIGINS` | API | *(sin valor)* | Lista separada por comas de orígenes permitidos. Obligatoria en producción; sin ella el arranque falla |
| `PUBLIC_CACHE_TTL_LIVE` | API | `30` | TTL en segundos de `/api/public/live` |
| `PUBLIC_CACHE_TTL_CONTENT` | API | `60` | TTL de `/events` y `/latest-sermon` |
| `PUBLIC_MEDIA_BASE_URL` | API | *(sin valor)* | Base pública de miniaturas y PDFs (V1.1) |
| `PUBLIC_MEDIA_PATH` | API | `/data/public` | Directorio de archivos promovidos (V1.1) |
| `VITE_PUBLIC_API_BASE_URL` | Landing | — | Base de la API pública que consume la landing |

Las existentes (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CAS_API_KEY`) no cambian. `SUPABASE_ANON_KEY` pasa a tener un segundo consumidor: `anonClient()`.

---

## 19. Orden recomendado de implementación

1. **Decisiones humanas** (§21) — dominio, hosting, slug de la iglesia.
2. **Fase 0** — infraestructura. Sin código de aplicación.
3. **Migración SQL** + tipos compartidos + **tests SQL** (T-01…T-16). Los tests **antes** que la API: si el modelo público está mal, ningún endpoint lo corrige.
4. **`anonClient()`** en `postgrest.ts` — cambio pequeño y aislado.
5. **Plugin público** con los tres endpoints y sus JSON Schema de respuesta.
6. **Una línea de allowlist** + tests T-22…T-25, T-32. Nunca antes del punto 5, para no dejar un prefijo abierto sin rutas detrás.
7. **CORS y caché** + tests T-27…T-31, T-34.
8. **Despliegue a staging** y verificación manual con `curl` sin token.
9. **Landing** (Fase 3) — repositorio propio, contra la API de staging.
10. **Control interno** (Fase 4).
11. **Hardening, E2E y runbook** (Fase 5).
12. **Producción**: promover con `CHURCH_PUBLIC_SLUG` y `PUBLIC_CORS_ORIGINS` reales.

V1.1 (posterior): promoción de archivos a `/data/public/`, ministerios públicos, announcements.

---

## 20. Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-1 | Una política `to anon` mal escrita expone contenido interno | Alto | Grants por columna (§4.3) como segunda barrera + T-07/T-08 |
| R-2 | "Estamos en vivo" queda encendido tras el culto | Medio | `live_events` fuera de ventana desaparece de `public_live` (`scheduled_at >= now() - 4h`); recordatorio en el checklist de cierre |
| R-3 | El estado en vivo depende de una persona (H-12, H-13) | Medio | Aceptado en V1 y documentado; detección automática requiere integración de plataforma, fuera de alcance |
| R-4 | Tráfico público sobre el VPS | Medio | Caché de borde (§8) + video en YouTube (§10) |
| R-5 | `trustProxy` permisivo (H-7) | Bajo en V1, **alto** con escrituras | Bloqueante declarado para la fase futura (§9) |
| R-6 | Divergencia entre título interno y público confunde al equipo | Bajo | Un solo bloque de UI muestra ambos (§15) |
| R-7 | La migración altera la visibilidad de miembros autenticados | Alto | T-14 y T-15 lo verifican explícitamente |
| R-8 | Rollback de migración con datos ya publicados | Medio | Las columnas nuevas son aditivas y anulables; revertir = quitar vistas y grants, sin pérdida de datos |

---

## 21. Preguntas bloqueantes (requieren decisión humana)

Ninguna puede resolverse desde el código.

1. **¿Cuál es el dominio definitivo?** Se necesitan tres nombres: landing, API y panel interno. Bloquea la Fase 0 completa.
2. **¿Se aprueba migrar la landing de InfinityFree a Cloudflare Pages?** Si la respuesta es no, hay que rehacer §8 y §13 con las limitaciones de InfinityFree, y el resultado será peor. Bloquea Fase 0 y condiciona Fase 3.
3. **¿Existe ya la iglesia real en la base de datos, con su slug definitivo?** El slug queda fijado en la configuración del despliegue y cambiarlo después obliga a redeploy. Bloquea `CHURCH_PUBLIC_SLUG`.
4. **¿Los sermones se publican en YouTube antes de aparecer en la web?** El diseño asume que sí (`watch_url` apunta a la plataforma). Si la iglesia quiere el video alojado en el VPS, cambia §10 y el presupuesto de infraestructura.
5. **¿Quién puede publicar en la web?** El plan asume `production.publish` (`admin` y `lider`). Si un `productor` debe poder hacerlo, se requiere un permiso nuevo en la matriz — que hoy está replicada en TypeScript, en SQL y en `rbac.test.ts`.
6. **¿La landing conserva su HTML actual o se rehace?** Afecta solo al alcance de la Fase 3, no al diseño de la API.

---

## Dependencies

- [PROJECT_STATE.md](../../PROJECT_STATE.md) — estado verificado del repositorio
- [PLAN_TECNICO_PLATAFORMA_IGLESIA.md](PLAN_TECNICO_PLATAFORMA_IGLESIA.md) — plan del pivote (parcialmente ejecutado)
- [PLAN_IGLESIA_EQUIPO_DIGITAL.md](PLAN_IGLESIA_EQUIPO_DIGITAL.md) — visión de producto

## Related Documents

- [AGENTS.md](../../AGENTS.md) — gotchas de desarrollo local
- [docs/02-operations/SUPABASE_AUTH.md](../02-operations/SUPABASE_AUTH.md)
- [docs/01-architecture/DEPLOYMENT_STAGING.md](../01-architecture/DEPLOYMENT_STAGING.md)

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-08-06 | 1.0.0 | Claude | Plan inicial de Church Public Portal V1, verificado contra `main` @ `fe52bc2` |
| 2026-08-09 | 1.1.0 | Codex | Re-verificación contra HEAD real; ajuste de working tree, grants para vistas `security_invoker`, TTL base `max-age=60`, alcance UI de Producciones y deuda de compose producción |
