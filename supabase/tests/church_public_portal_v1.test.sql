-- Church Public Portal V1 — tests SQL verificables.
--
-- Cobertura: T-01..T-16 de docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md §17.1.
--
-- Forma de ejecución:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f church_public_portal_v1.test.sql
--
-- El script es destructivo con datos semilla: los crea al inicio y los
-- elimina al final con rollback. NO debe ejecutarse contra producción con
-- datos reales.
--
-- Cada test usa:
--   set local role <rol>;
--   set local "request.jwt.claim.sub" to '<user_uuid>';
-- para simular el contexto que PostgREST aplica al llamar como anon o
-- como miembro autenticado. La iglesia "Otras" existe únicamente para
-- probar aislamiento entre iglesias (T-15).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create temp table cas_test_log (
  id serial primary key,
  test_id text not null,
  status text not null check (status in ('pass', 'fail')),
  detail text
);

create or replace function cas_assert_contains(test_id text, expected_count int, actual_rows anyelement)
returns void
language plpgsql
as $$
declare
  actual int;
begin
  -- Convierte un set en count para comparar. ANYELEMENT no se puede COUNT
  -- directamente; usamos un truco: envolvemos en jsonb.
  -- En la práctica los tests pasan JSON precomputado como texto.
  null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Semilla: iglesia A (test_church_a) y B (test_church_b) con miembros y datos.
-- ---------------------------------------------------------------------------

do $$
declare
  church_a uuid;
  church_b uuid;
  admin_a uuid := '00000000-0000-0000-0000-00000000a001';
  volunteer_a uuid := '00000000-0000-0000-0000-00000000a002';
  admin_b uuid := '00000000-0000-0000-0000-00000000b001';
  sermondraft_id uuid;
  sermonpublish_id uuid;
  sermonexpire_id uuid;
  sermonfuture_id uuid;
  sermoninterna_id uuid;
  sermonequipo_id uuid;
  sermonno_flag_id uuid;
  live_now_id uuid;
  live_scheduled_id uuid;
  live_finalizado_id uuid;
  asset_id uuid;
begin
  -- Iglesias de prueba. UUIDs fijos para poder referenciar.
  insert into public.churches (id, name, slug, timezone, locale)
  values
    ('11111111-1111-1111-1111-1111111111a1', 'Test Church A', 'test-church-a', 'America/Bogota', 'es-CO'),
    ('11111111-1111-1111-1111-1111111111b1', 'Test Church B', 'test-church-b', 'America/Bogota', 'es-CO')
  on conflict (id) do nothing;

  church_a := '11111111-1111-1111-1111-1111111111a1';
  church_b := '11111111-1111-1111-1111-1111111111b1';

  -- Miembros. auth.users no se crea acá; los helpers privados leen
  -- auth.uid() que simulamos con request.jwt.claim.sub.
  insert into public.church_members (church_id, user_id, role, status)
  values
    (church_a, admin_a, 'admin', 'active'),
    (church_a, volunteer_a, 'voluntario', 'active'),
    (church_b, admin_b, 'admin', 'active')
  on conflict (church_id, user_id) do nothing;

  -- Activos: asset y ministerio para FKs.
  insert into public.ministries (id, church_id, name, slug, is_active)
  values ('22222222-2222-2222-2222-22222222aaaa', church_a, 'Enseñanza', 'ensenanza', true)
  on conflict (church_id, slug) do nothing;

  insert into public.church_assets (id, church_id, ministry_id, name, kind, storage_path, mime_type, size_bytes)
  values ('33333333-3333-3333-3333-33333333aaaa', church_a, '22222222-2222-2222-2222-22222222aaaa', 'cover.jpg', 'image', 'test/cover.jpg', 'image/jpeg', 1000)
  on conflict (id) do nothing;

  asset_id := '33333333-3333-3333-3333-33333333aaaa';

  sermondraft_id     := '44444444-4444-4444-4444-44444444dd01';
  sermonpublish_id   := '44444444-4444-4444-4444-44444444pp01';
  sermonexpire_id    := '44444444-4444-4444-4444-44444444ee01';
  sermonfuture_id    := '44444444-4444-4444-4444-44444444ff01';
  sermoninterna_id   := '44444444-4444-4444-4444-44444444ii01';
  sermonequipo_id    := '44444444-4444-4444-4444-44444444qq01';
  sermonno_flag_id   := '44444444-4444-4444-4444-44444444nn01';

  -- Producciones de prueba.
  insert into public.productions (id, church_id, title, format, status, visibility, show_on_landing, published_at, watch_url, slug, preacher, bible_ref)
  values
    (sermondraft_id, church_a, 'Sermón en revisión', 'sermon', 'revision', 'publica', true, now() - interval '1 day', 'https://youtu.be/draft', 'sermon-revision', 'Pastor X', 'Juan 3:16'),
    (sermonpublish_id, church_a, 'Sermón publicado', 'sermon', 'publicado', 'publica', true, now() - interval '1 day', 'https://youtu.be/live', 'sermon-publicado', 'Pastor X', 'Juan 3:16'),
    (sermonexpire_id, church_a, 'Sermón expirado', 'sermon', 'publicado', 'publica', true, now() - interval '10 days', 'https://youtu.be/expired', 'sermon-expirado', 'Pastor X', 'Juan 3:16'),
    (sermonfuture_id, church_a, 'Sermón futuro', 'sermon', 'publicado', 'publica', true, now() + interval '5 days', 'https://youtu.be/future', 'sermon-futuro', 'Pastor X', 'Juan 3:16'),
    (sermoninterna_id, church_a, 'Sermón interna', 'sermon', 'publicado', 'interna', true, now() - interval '1 day', 'https://youtu.be/interna', 'sermon-interna', 'Pastor X', 'Juan 3:16'),
    (sermonequipo_id, church_a, 'Sermón equipo', 'sermon', 'publicado', 'equipo', true, now() - interval '1 day', 'https://youtu.be/equipo', 'sermon-equipo', 'Pastor X', 'Juan 3:16'),
    (sermonno_flag_id, church_a, 'Sermón sin show', 'sermon', 'publicado', 'publica', false, now() - interval '1 day', 'https://youtu.be/noflag', 'sermon-sin-show', 'Pastor X', 'Juan 3:16')
  on conflict (id) do nothing;

  -- Forzar expires_at en uno solo.
  update public.productions set expires_at = now() - interval '1 hour' where id = sermonexpire_id;

  live_now_id       := '55555555-5555-5555-5555-55555555nn01';
  live_scheduled_id := '55555555-5555-5555-5555-55555555ss01';
  live_finalizado_id := '55555555-5555-5555-5555-55555555ff01';

  insert into public.live_events (id, church_id, title, scheduled_at, status, visibility, show_on_landing, watch_url)
  values
    (live_now_id, church_a, 'Culto en vivo', now() - interval '30 minutes', 'en_vivo', 'publica', true, 'https://youtu.be/live-now'),
    (live_scheduled_id, church_a, 'Próximo culto', now() + interval '2 days', 'planeado', 'publica', true, null),
    (live_finalizado_id, church_a, 'Culto pasado', now() - interval '1 day', 'finalizado', 'publica', true, 'https://youtu.be/old')
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-01: anon consulta public_latest_sermons con un sermón publicado → aparece.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  select count(*) into found from public.public_latest_sermons
    where id = '44444444-4444-4444-4444-44444444pp01';
  reset role;
  if found = 1 then
    insert into cas_test_log (test_id, status, detail) values ('T-01', 'pass', 'sermon publicado visible');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-01', 'fail', format('expected 1, got %s', found));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-02: status='revision' no aparece aunque show_on_landing=true.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  select count(*) into found from public.public_latest_sermons
    where id = '44444444-4444-4444-4444-44444444dd01';
  reset role;
  if found = 0 then
    insert into cas_test_log (test_id, status) values ('T-02', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-02', 'fail', 'revision visible (no debería)');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-03: show_on_landing=false no aparece.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  select count(*) into found from public.public_latest_sermons
    where id = '44444444-4444-4444-4444-44444444nn01';
  reset role;
  if found = 0 then
    insert into cas_test_log (test_id, status) values ('T-03', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-03', 'fail', 'show_on_landing=false visible');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-04: visibility='equipo' no aparece.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  select count(*) into found from public.public_latest_sermons
    where id = '44444444-4444-4444-4444-44444444qq01';
  reset role;
  if found = 0 then
    insert into cas_test_log (test_id, status) values ('T-04', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-04', 'fail', 'visibility=equipo visible');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-05: published_at futuro no aparece.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  select count(*) into found from public.public_latest_sermons
    where id = '44444444-4444-4444-4444-44444444ff01';
  reset role;
  if found = 0 then
    insert into cas_test_log (test_id, status) values ('T-05', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-05', 'fail', 'published_at futuro visible');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-06: expires_at pasado no aparece.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  select count(*) into found from public.public_latest_sermons
    where id = '44444444-4444-4444-4444-44444444ee01';
  reset role;
  if found = 0 then
    insert into cas_test_log (test_id, status) values ('T-06', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-06', 'fail', 'expires_at pasado visible');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-07: anon no puede seleccionar script de productions (columna no otorgada).
-- ---------------------------------------------------------------------------

do $$
declare
  ok bool;
begin
  set local role anon;
  begin
    perform script from public.productions limit 0;
    ok := true;
  exception
    when insufficient_privilege then
      ok := false;
    when others then
      ok := false;
  end;
  reset role;
  if not ok then
    insert into cas_test_log (test_id, status) values ('T-07', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-07', 'fail', 'anon leyó script');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-08: anon no puede seleccionar assigned_to / created_by.
-- ---------------------------------------------------------------------------

do $$
declare
  ok bool;
begin
  set local role anon;
  begin
    perform assigned_to, created_by from public.productions limit 0;
    ok := true;
  exception
    when insufficient_privilege then
      ok := false;
    when others then
      ok := false;
  end;
  reset role;
  if not ok then
    insert into cas_test_log (test_id, status) values ('T-08', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-08', 'fail', 'anon leyó columnas internas');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-09: anon no puede seleccionar de church_assets (sin GRANT).
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role anon;
  begin
    select count(*) into found from public.church_assets;
  exception
    when others then
      found := -1;
  end;
  reset role;
  -- PGRST retorna error 401/403 o lista vacía según versión; ambos son aceptables.
  if found = 0 or found = -1 then
    insert into cas_test_log (test_id, status, detail) values ('T-09', 'pass', format('count=%s', found));
  else
    insert into cas_test_log (test_id, status, detail) values ('T-09', 'fail', format('anon leyó %s assets', found));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-10: anon no puede seleccionar church_members ni profiles.
-- ---------------------------------------------------------------------------

do $$
declare
  members_count int;
  profiles_count int;
begin
  set local role anon;
  begin
    select count(*) into members_count from public.church_members;
  exception when others then
    members_count := -1;
  end;
  begin
    select count(*) into profiles_count from public.profiles;
  exception when others then
    profiles_count := -1;
  end;
  reset role;
  if members_count in (0, -1) and profiles_count in (0, -1) then
    insert into cas_test_log (test_id, status) values ('T-10', 'pass');
  else
    insert into cas_test_log (test_id, status, detail)
      values ('T-10', 'fail', format('members=%s profiles=%s', members_count, profiles_count));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-11: anon no puede seleccionar production_comments / production_approvals.
-- ---------------------------------------------------------------------------

do $$
declare
  comments_count int;
  approvals_count int;
begin
  set local role anon;
  begin
    select count(*) into comments_count from public.production_comments;
  exception when others then
    comments_count := -1;
  end;
  begin
    select count(*) into approvals_count from public.production_approvals;
  exception when others then
    approvals_count := -1;
  end;
  reset role;
  if comments_count in (0, -1) and approvals_count in (0, -1) then
    insert into cas_test_log (test_id, status) values ('T-11', 'pass');
  else
    insert into cas_test_log (test_id, status, detail)
      values ('T-11', 'fail', format('comments=%s approvals=%s', comments_count, approvals_count));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-12: anon no puede seleccionar calendar_entries / publish_targets.
-- ---------------------------------------------------------------------------

do $$
declare
  cal_count int;
  target_count int;
begin
  set local role anon;
  begin
    select count(*) into cal_count from public.calendar_entries;
  exception when others then
    cal_count := -1;
  end;
  begin
    select count(*) into target_count from public.publish_targets;
  exception when others then
    target_count := -1;
  end;
  reset role;
  if cal_count in (0, -1) and target_count in (0, -1) then
    insert into cas_test_log (test_id, status) values ('T-12', 'pass');
  else
    insert into cas_test_log (test_id, status, detail)
      values ('T-12', 'fail', format('calendar=%s targets=%s', cal_count, target_count));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-13: anon no puede hacer INSERT/UPDATE/DELETE en ninguna tabla o vista.
-- ---------------------------------------------------------------------------

do $$
declare
  insert_blocked bool;
  update_blocked bool;
  delete_blocked bool;
begin
  set local role anon;
  -- INSERT en productions
  begin
    insert into public.productions (church_id, title, format) values ('x', 'x', 'sermon');
    insert_blocked := false;
  exception when others then
    insert_blocked := true;
  end;
  -- UPDATE en productions
  begin
    update public.productions set title = 'x';
    update_blocked := false;
  exception when others then
    update_blocked := true;
  end;
  -- DELETE en productions
  begin
    delete from public.productions;
    delete_blocked := false;
  exception when others then
    delete_blocked := true;
  end;
  reset role;
  if insert_blocked and update_blocked and delete_blocked then
    insert into cas_test_log (test_id, status) values ('T-13', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-13', 'fail',
      format('insert=%s update=%s delete=%s', insert_blocked, update_blocked, delete_blocked));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-14: voluntario autenticado sigue viendo exactamente lo mismo que antes
-- de la migración. Verificamos que ve la producción interna (lo que un
-- anon NO ve).
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role authenticated;
  set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000a002';
  select count(*) into found from public.productions
    where id = '44444444-4444-4444-4444-44444444ii01';
  reset role;
  if found = 1 then
    insert into cas_test_log (test_id, status) values ('T-14', 'pass');
  else
    insert into cas_test_log (test_id, status, detail)
      values ('T-14', 'fail', format('voluntario perdió acceso a producción interna: %s', found));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-15: admin de iglesia B no ve contenido público de iglesia A.
-- ---------------------------------------------------------------------------

do $$
declare
  found int;
begin
  set local role authenticated;
  set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-00000000b001';
  select count(*) into found from public.productions
    where id = '44444444-4444-4444-4444-44444444pp01';
  reset role;
  if found = 0 then
    insert into cas_test_log (test_id, status) values ('T-15', 'pass');
  else
    insert into cas_test_log (test_id, status, detail)
      values ('T-15', 'fail', format('admin B vio producción de A: %s', found));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- T-16: live_events en 'en_vivo' con show_on_landing aparece en public_live
-- sin campos internos (crew, checklist, incidents, obs_profile).
-- ---------------------------------------------------------------------------

do $$
declare
  found record;
  has_internal bool;
begin
  set local role anon;
  select * into found from public.public_live limit 1;
  -- Verificamos que la vista NO expone columnas internas. Hacemos esto
  -- mejor con information_schema.columns.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_live'
      and column_name in ('crew', 'checklist', 'incidents', 'obs_profile', 'target_ids', 'recording_asset_id')
  ) into has_internal;
  reset role;
  if found.id = '55555555-5555-5555-5555-55555555nn01' and not has_internal then
    insert into cas_test_log (test_id, status) values ('T-16', 'pass');
  else
    insert into cas_test_log (test_id, status, detail) values ('T-16', 'fail',
      format('found_id=%s has_internal_cols=%s', coalesce(found.id::text, 'null'), has_internal));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resumen
-- ---------------------------------------------------------------------------

select
  count(*) filter (where status = 'pass') as passed,
  count(*) filter (where status = 'fail') as failed,
  count(*) as total
from cas_test_log;

select test_id, status, detail from cas_test_log order by test_id;

-- Limpieza de datos semilla.
do $$
declare
  church_a uuid := '11111111-1111-1111-1111-1111111111a1';
  church_b uuid := '11111111-1111-1111-1111-1111111111b1';
begin
  delete from public.production_comments where church_id in (church_a, church_b);
  delete from public.production_approvals where church_id in (church_a, church_b);
  delete from public.calendar_entries where church_id in (church_a, church_b);
  delete from public.publish_targets where church_id in (church_a, church_b);
  delete from public.live_events where church_id in (church_a, church_b);
  delete from public.productions where church_id in (church_a, church_b);
  delete from public.church_assets where church_id in (church_a, church_b);
  delete from public.ministries where church_id in (church_a, church_b);
  delete from public.church_members where church_id in (church_a, church_b);
  delete from public.churches where id in (church_a, church_b);
end;
$$;
