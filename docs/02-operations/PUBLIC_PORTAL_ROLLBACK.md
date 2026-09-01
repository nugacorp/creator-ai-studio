# Rollback — Church Public Portal V1 (migración SQL + plugin API)

## Cuándo usar este runbook

El portal público muestra datos incorrectos, una política `to anon` expone contenido interno, o el plugin Fastify impide el arranque en producción.

## Acción inmediata (menos de 5 minutos)

### Paso 1 — Quitar el plugin sin rollback de DB

Si el problema está **solo en la API** (CORS, caché, plugin no carga), basta con **no definir `CHURCH_PUBLIC_SLUG`** en el despliegue siguiente:

```bash
unset CHURCH_PUBLIC_SLUG
unset PUBLIC_CORS_ORIGINS
```

El plugin no se registra → `GET /api/public/*` devuelve 404 (T-33) sin afectar el resto de la API.

### Paso 2 — Revertir visibilidad pública en la DB

Si ya hay contenido marcado como público y necesitas ocultarlo antes de re-deploy, ejecuta en la base:

```sql
update public.productions
   set show_on_landing = false,
       visibility = 'interna'
 where visibility = 'publica';

update public.live_events
   set show_on_landing = false,
       visibility = 'interna'
 where visibility = 'publica';
```

Esto es **no destructivo**: solo cambia la marca. Restaurable con un nuevo PATCH cuando el problema se resuelva.

### Paso 3 — Revertir la migración completa (si Paso 1 y 2 no alcanzan)

Solo si la causa raíz está en el esquema (política mal escrita, GRANT indebido, vista con columnas sensibles).

**Orden estricto:**

1. `drop view if exists public.public_latest_sermons;`
2. `drop view if exists public.public_events;`
3. `drop view if exists public.public_live;`
4. `revoke select on public.productions from anon;`
5. `revoke select on public.live_events from anon;`
6. `revoke select on public.churches from anon;`
7. `drop policy if exists live_events_anon_select on public.live_events;`
8. `drop policy if exists productions_anon_select on public.productions;`
9. `drop policy if exists churches_anon_select on public.churches;`
10. `alter table public.live_events drop column if exists cover_asset_id, drop column if exists watch_url, drop column if exists public_title, drop column if exists show_on_landing, drop column if exists visibility;`
11. `alter table public.productions drop column if exists expires_at, drop column if exists watch_url, drop column if exists cover_asset_id, drop column if exists public_summary, drop column if exists public_title, drop column if exists slug, drop column if exists show_on_landing, drop column if exists visibility;`
12. `alter table public.publish_targets drop constraint if exists publish_targets_platform_check; alter table public.publish_targets add constraint publish_targets_platform_check check (platform in ('youtube', 'facebook', 'instagram', 'tiktok', 'x'));`
13. `drop index if exists idx_productions_public; drop index if exists idx_live_events_public; drop index if exists idx_productions_slug;`
14. `alter table public.productions drop constraint if exists productions_slug_unique;`

Verificación post-rollback:

```sql
-- Esperado: 0 filas
select count(*) from public.public_live;
-- Esperado: error de relación inexistente
select * from public.public_live;
-- Esperado: todas las columnas marcadas como nulas
select visibility, count(*) from public.productions group by 1;
select visibility, count(*) from public.live_events group by 1;
```

## Restaurar la versión previa del plugin

El plugin se registra solo si `CHURCH_PUBLIC_SLUG` está definido. Sin esa variable, el código del plugin no se monta en absoluto (no hay riesgo residual).

Para volver a activarlo: redeploy con `CHURCH_PUBLIC_SLUG=<slug>` y `PUBLIC_CORS_ORIGINS=https://landing.example.com`.

## Comunicación

1. Apuntar el incidente en `docs/02-operations/INCIDENTS.md` (crear si no existe).
2. Notificar al equipo (Slack/email) con la causa raíz, el paso ejecutado y la hora del rollback.
3. Si afecta la landing visible al público, coordinar con el equipo de la iglesia antes de hacer el rollback para evitar confusión sobre el "Estamos en vivo" caído.

## Post-mortem

Dentro de 48 horas: añadir un ADR o `docs/03-product/POSTMORTEM_<fecha>.md` con causa raíz, decisión de reversibilidad y acción preventiva.
