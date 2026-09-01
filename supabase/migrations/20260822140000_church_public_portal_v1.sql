-- Church Public Portal V1 — modelo público de solo lectura.
--
-- Implementa §3 y §4 de docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md.
--
-- Cambios:
--   1. Campos ortogonales de visibilidad en productions y live_events.
--   2. publish_targets.platform se extiende con 'web'.
--   3. Índices parciales sobre el predicado público.
--   4. Políticas RLS to anon (no se altera la visibilidad de authenticated).
--   5. GRANT SELECT por columna a anon sobre las tablas necesarias para el predicado.
--   6. Vistas security_invoker que son la única superficie que la API pública consulta.
--
-- Decisiones explícitas (ver AD-P1..AD-P3 del plan):
--   - platform='web' se agrega al catálogo. NO se usa calendar_entries con destino
--     web en V1 porque no hay ejecutor (H-4 del plan). La programación temporal
--     se resuelve con published_at <= now().
--   - visibility responde "quién puede verlo", status responde "en qué punto del
--     trabajo está". Son ejes independientes. Default 'interna' para que una
--     producción existente nunca quede pública por accidente.
--   - Las vistas usan security_invoker = on (PG 15+) para que las políticas RLS
--     y los GRANT por columna se evalúen contra anon, no contra el owner.
--   - Ningún GRANT de INSERT/UPDATE/DELETE a anon en ninguna tabla.
--   - Las columnas internas (script, assigned_to, created_by, summary interno,
--     legacy_episode_id, source_asset_ids, crew, checklist, incidents, obs_profile)
--     NO se otorgan a anon.
--   - Tablas sensibles (church_members, church_assets, production_comments,
--     production_approvals, publish_targets, calendar_entries, profiles) NO
--     reciben ningún GRANT a anon.

-- ---------------------------------------------------------------------------
-- 1. productions: campos públicos ortogonales
-- ---------------------------------------------------------------------------

alter table public.productions
  add column if not exists visibility text not null default 'interna'
    check (visibility in ('interna', 'equipo', 'publica'));

alter table public.productions
  add column if not exists show_on_landing boolean not null default false;

alter table public.productions
  add column if not exists slug text;

alter table public.productions
  add column if not exists public_title text;

alter table public.productions
  add column if not exists public_summary text;

alter table public.productions
  add column if not exists cover_asset_id uuid references public.church_assets (id) on delete set null;

alter table public.productions
  add column if not exists watch_url text;

alter table public.productions
  add column if not exists expires_at timestamptz;

-- Unicidad de slug por iglesia. Postgres trata NULLs como distintos, por lo
-- que las filas sin slug no colisionan entre sí. Solo las producciones con
-- slug definido entran en la restricción.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'productions_slug_unique'
  ) then
    alter table public.productions
      add constraint productions_slug_unique unique (church_id, slug);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. live_events: campos públicos ortogonales
-- ---------------------------------------------------------------------------

alter table public.live_events
  add column if not exists visibility text not null default 'interna'
    check (visibility in ('interna', 'equipo', 'publica'));

alter table public.live_events
  add column if not exists show_on_landing boolean not null default false;

alter table public.live_events
  add column if not exists public_title text;

alter table public.live_events
  add column if not exists watch_url text;

alter table public.live_events
  add column if not exists cover_asset_id uuid references public.church_assets (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. publish_targets: aceptar 'web' como destino
-- ---------------------------------------------------------------------------

alter table public.publish_targets drop constraint if exists publish_targets_platform_check;
alter table public.publish_targets add constraint publish_targets_platform_check
  check (platform in ('youtube', 'facebook', 'instagram', 'tiktok', 'x', 'web'));

-- ---------------------------------------------------------------------------
-- 4. Índices parciales sobre el predicado público
-- ---------------------------------------------------------------------------

create index if not exists idx_productions_public
  on public.productions (church_id, published_at desc)
  where show_on_landing and visibility = 'publica' and status = 'publicado';

create index if not exists idx_live_events_public
  on public.live_events (church_id, scheduled_at)
  where show_on_landing and visibility = 'publica';

create index if not exists idx_productions_slug
  on public.productions (church_id, slug)
  where slug is not null;

-- ---------------------------------------------------------------------------
-- 5. Políticas RLS to anon
-- ---------------------------------------------------------------------------

-- productions: select para anon cuando cumple el predicado completo.
-- Postgres combina políticas del mismo comando con OR, así que esta política
-- AMPLÍA el acceso solo para el rol anon sin alterar el comportamiento de
-- authenticated (que sigue pasando por productions_select existente).
drop policy if exists productions_anon_select on public.productions;
create policy productions_anon_select on public.productions for select to anon
  using (
    show_on_landing
    and visibility = 'publica'
    and status = 'publicado'
    and published_at is not null
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- live_events: select para anon si está marcada pública y dentro de la ventana
-- de 4h alrededor del horario. Esto evita que "estamos en vivo" quede pegado
-- después del culto.
drop policy if exists live_events_anon_select on public.live_events;
create policy live_events_anon_select on public.live_events for select to anon
  using (
    show_on_landing
    and visibility = 'publica'
    and status in ('planeado', 'preflight', 'en_vivo')
    and scheduled_at >= now() - interval '4 hours'
  );

-- churches: anon puede leer las iglesias para resolver nombres en respuestas
-- públicas. Solo se otorgan columnas públicas.
drop policy if exists churches_anon_select on public.churches;
create policy churches_anon_select on public.churches for select to anon
  using (true);

-- ---------------------------------------------------------------------------
-- 6. GRANT SELECT por columna a anon
-- ---------------------------------------------------------------------------

-- productions: columnas mínimas necesarias para que el predicado y la
-- respuesta pública funcionen. Nunca se otorgan script, assigned_to, created_by,
-- summary interno, legacy_episode_id, source_asset_ids.
grant select (
  id, church_id, ministry_id, title, public_title, public_summary,
  format, status, visibility, show_on_landing,
  service_date, preacher, bible_ref, slug, cover_asset_id,
  watch_url, published_at, expires_at
) on public.productions to anon;

-- live_events: idem, sin crew, checklist, incidents, obs_profile,
-- recording_asset_id, target_ids.
grant select (
  id, church_id, title, public_title, scheduled_at, status,
  visibility, show_on_landing, watch_url, cover_asset_id
) on public.live_events to anon;

-- churches: solo metadatos públicos.
grant select (id, name, slug, timezone, locale) on public.churches to anon;

-- ---------------------------------------------------------------------------
-- 7. Vistas públicas con security_invoker
-- ---------------------------------------------------------------------------

-- public_live: primer registro vivo o programado dentro de la ventana.
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
  and le.scheduled_at >= now() - interval '4 hours'
order by
  case le.status when 'en_vivo' then 0 when 'preflight' then 1 else 2 end,
  le.scheduled_at asc
limit 1;

-- public_events: próximos eventos públicos programados.
create or replace view public.public_events
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
  and le.status in ('planeado', 'preflight')
  and le.scheduled_at >= now()
order by le.scheduled_at asc;

-- public_latest_sermons: últimos sermones publicados en la web.
create or replace view public.public_latest_sermons
  with (security_invoker = on) as
select
  p.id,
  coalesce(p.public_title, p.title) as title,
  p.public_summary as summary,
  p.slug,
  p.preacher,
  p.bible_ref,
  p.service_date,
  p.published_at,
  p.watch_url,
  p.cover_asset_id,
  p.church_id,
  c.slug as church_slug
from public.productions p
join public.churches c on c.id = p.church_id
where p.show_on_landing
  and p.visibility = 'publica'
  and p.status = 'publicado'
  and p.published_at is not null
  and p.published_at <= now()
  and (p.expires_at is null or p.expires_at > now())
  and p.format = 'sermon'
order by p.published_at desc;

grant select on public.public_live to anon;
grant select on public.public_events to anon;
grant select on public.public_latest_sermons to anon;

-- ---------------------------------------------------------------------------
-- 8. Comentario para auditabilidad
-- ---------------------------------------------------------------------------

comment on column public.productions.visibility is
  'Visibilidad pública de la producción. Independiente del status interno.';
comment on column public.productions.show_on_landing is
  'Si true y visibility=publica y status=publicado y published_at<=now(), la producción aparece en el portal público.';
comment on column public.live_events.visibility is
  'Visibilidad pública del evento en vivo.';
comment on column public.live_events.show_on_landing is
  'Si true y visibility=publica y status en (planeado,preflight,en_vivo) y dentro de la ventana de 4h, aparece en el portal público.';
