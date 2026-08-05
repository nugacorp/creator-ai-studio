-- Church digital team platform — domain schema, permission matrix and RLS.
--
-- Mirrors packages/shared/src/church.ts. The permission matrix lives in two
-- places on purpose: TypeScript enforces it at the API boundary with readable
-- 403s, Postgres enforces it again so a leaked token cannot bypass the API.
-- Both are transcriptions of §4 of docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Bogota',
  locale text not null default 'es-CO',
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.church_members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'lider', 'productor', 'disenador', 'voluntario')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, user_id)
);

create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  lead_user_id uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, slug)
);

-- The DAM. Bytes live on the VPS volume (AD-1); this table holds the index.
create table if not exists public.church_assets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid references public.ministries (id) on delete set null,
  name text not null,
  kind text not null check (kind in ('video', 'audio', 'image', 'document', 'template')),
  storage_path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  thumbnail_path text,
  current_version integer not null default 1,
  versions jsonb not null default '[]'::jsonb,
  series text,
  preacher text,
  bible_ref text,
  tags text[] not null default '{}',
  service_date date,
  uploaded_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  drive_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Maintained by trg_church_assets_search below. Not a generated column:
  -- array_to_string() is STABLE, and stored generated columns require IMMUTABLE.
  search_tsv tsvector
);

create table if not exists public.productions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  ministry_id uuid references public.ministries (id) on delete set null,
  title text not null,
  format text not null check (format in ('sermon', 'clip', 'reel', 'anuncio', 'testimonio', 'devocional')),
  status text not null default 'idea'
    check (status in ('idea', 'grabacion', 'edicion', 'revision', 'aprobado', 'publicado')),
  summary text,
  script text,
  service_date date,
  preacher text,
  bible_ref text,
  assigned_to uuid[] not null default '{}',
  source_asset_ids uuid[] not null default '{}',
  -- Bridge to the filesystem episode storage that already exists.
  legacy_episode_id text,
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_comments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  production_id uuid not null references public.productions (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.production_approvals (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  production_id uuid not null references public.productions (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decision text check (decision in ('aprobado', 'cambios')),
  comment text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.publish_targets (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  platform text not null check (platform in ('youtube', 'facebook', 'instagram', 'tiktok', 'x')),
  display_name text not null,
  -- 'assisted' builds the ready-to-post package for a human (AD-3).
  mode text not null default 'assisted' check (mode in ('auto', 'assisted')),
  credentials_ref text,
  render_preset text not null default '16:9-1080p'
    check (render_preset in ('16:9-1080p', '9:16-1080x1920', '1:1-1080')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  status text not null default 'planeado'
    check (status in ('planeado', 'preflight', 'en_vivo', 'finalizado')),
  target_ids uuid[] not null default '{}',
  crew jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  obs_profile text,
  incidents jsonb not null default '[]'::jsonb,
  recording_asset_id uuid references public.church_assets (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  production_id uuid references public.productions (id) on delete cascade,
  live_event_id uuid references public.live_events (id) on delete cascade,
  target_id uuid not null references public.publish_targets (id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'programado'
    check (status in ('programado', 'publicando', 'publicado', 'fallido')),
  attempts integer not null default 0,
  last_error text,
  external_url text,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_entry_has_subject check (
    production_id is not null or live_event_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_church_members_user on public.church_members (user_id);
create index if not exists idx_church_members_church on public.church_members (church_id, role);
create index if not exists idx_ministries_church on public.ministries (church_id) where is_active;
create index if not exists idx_assets_church_kind on public.church_assets (church_id, kind);
create index if not exists idx_assets_church_created on public.church_assets (church_id, created_at desc);
create index if not exists idx_assets_service_date on public.church_assets (church_id, service_date desc);
create index if not exists idx_assets_search on public.church_assets using gin (search_tsv);
create index if not exists idx_assets_tags on public.church_assets using gin (tags);
create index if not exists idx_productions_church_status on public.productions (church_id, status);
create index if not exists idx_productions_service_date on public.productions (church_id, service_date desc);
create index if not exists idx_productions_assigned on public.productions using gin (assigned_to);
create index if not exists idx_production_comments_production on public.production_comments (production_id, created_at desc);
create index if not exists idx_production_approvals_production on public.production_approvals (production_id, created_at desc);
create index if not exists idx_publish_targets_church on public.publish_targets (church_id) where is_active;
create index if not exists idx_live_events_church_time on public.live_events (church_id, scheduled_at desc);
create index if not exists idx_calendar_entries_due on public.calendar_entries (status, scheduled_for)
  where status in ('programado', 'publicando');
create index if not exists idx_calendar_entries_church_time on public.calendar_entries (church_id, scheduled_for);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'churches', 'church_members', 'ministries', 'church_assets',
    'productions', 'publish_targets', 'live_events', 'calendar_entries'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Asset full-text search
-- ---------------------------------------------------------------------------

create or replace function public.church_assets_refresh_search()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv := to_tsvector(
    'spanish'::regconfig,
    coalesce(new.name, '') || ' ' ||
    coalesce(new.series, '') || ' ' ||
    coalesce(new.preacher, '') || ' ' ||
    coalesce(new.bible_ref, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '')
  );
  return new;
end;
$$;

drop trigger if exists trg_church_assets_search on public.church_assets;
create trigger trg_church_assets_search
  before insert or update of name, series, preacher, bible_ref, tags
  on public.church_assets
  for each row execute function public.church_assets_refresh_search();

-- ---------------------------------------------------------------------------
-- Membership bootstrap
-- ---------------------------------------------------------------------------

-- Without this the creator of a church could never read it back: every select
-- policy requires an active membership.
create or replace function public.grant_creator_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_user_id is not null then
    insert into public.church_members (church_id, user_id, role, status)
    values (new.id, new.created_by_user_id, 'admin', 'active')
    on conflict (church_id, user_id) do update set role = 'admin', status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_churches_grant_creator_admin on public.churches;
create trigger trg_churches_grant_creator_admin
  after insert on public.churches
  for each row execute function public.grant_creator_admin_membership();

-- ---------------------------------------------------------------------------
-- Permission matrix (mirror of CHURCH_PERMISSION_MATRIX)
-- ---------------------------------------------------------------------------

create or replace function public.church_role(p_church_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.church_members m
  where m.church_id = p_church_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1
$$;

create or replace function public.is_church_member(p_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.church_role(p_church_id) is not null
$$;

create or replace function public.church_can(p_church_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case p_permission
      when 'library.view'             then r in ('admin', 'lider', 'productor', 'disenador', 'voluntario')
      when 'asset.upload'             then r in ('admin', 'lider', 'productor', 'disenador', 'voluntario')
      when 'asset.delete'             then r in ('admin')
      when 'production.create'        then r in ('admin', 'lider', 'productor')
      when 'production.edit_script'   then r in ('admin', 'lider', 'productor')
      when 'production.upload_art'    then r in ('admin', 'lider', 'productor', 'disenador')
      when 'production.render'        then r in ('admin', 'lider', 'productor')
      when 'production.approve'       then r in ('admin', 'lider')
      when 'production.publish'       then r in ('admin', 'lider')
      when 'live.control'             then r in ('admin', 'lider', 'productor')
      when 'team.manage'              then r in ('admin')
      when 'credentials.manage'       then r in ('admin')
      when 'comment.write'            then r in ('admin', 'lider', 'productor', 'disenador', 'voluntario')
      else false
    end,
    false
  )
  from (select public.church_role(p_church_id) as r) role_lookup
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.churches enable row level security;
alter table public.church_members enable row level security;
alter table public.ministries enable row level security;
alter table public.church_assets enable row level security;
alter table public.productions enable row level security;
alter table public.production_comments enable row level security;
alter table public.production_approvals enable row level security;
alter table public.publish_targets enable row level security;
alter table public.live_events enable row level security;
alter table public.calendar_entries enable row level security;

-- churches
drop policy if exists churches_select on public.churches;
create policy churches_select on public.churches for select
  using (public.is_church_member(id));

drop policy if exists churches_insert on public.churches;
create policy churches_insert on public.churches for insert
  with check (auth.uid() is not null and created_by_user_id = auth.uid());

drop policy if exists churches_update on public.churches;
create policy churches_update on public.churches for update
  using (public.church_can(id, 'team.manage'))
  with check (public.church_can(id, 'team.manage'));

drop policy if exists churches_delete on public.churches;
create policy churches_delete on public.churches for delete
  using (public.church_can(id, 'team.manage'));

-- church_members
drop policy if exists members_select on public.church_members;
create policy members_select on public.church_members for select
  using (user_id = auth.uid() or public.is_church_member(church_id));

drop policy if exists members_insert on public.church_members;
create policy members_insert on public.church_members for insert
  with check (public.church_can(church_id, 'team.manage'));

drop policy if exists members_update on public.church_members;
create policy members_update on public.church_members for update
  using (public.church_can(church_id, 'team.manage'))
  with check (public.church_can(church_id, 'team.manage'));

drop policy if exists members_delete on public.church_members;
create policy members_delete on public.church_members for delete
  using (public.church_can(church_id, 'team.manage'));

-- ministries
drop policy if exists ministries_select on public.ministries;
create policy ministries_select on public.ministries for select
  using (public.is_church_member(church_id));

drop policy if exists ministries_write on public.ministries;
create policy ministries_write on public.ministries for all
  using (public.church_can(church_id, 'team.manage'))
  with check (public.church_can(church_id, 'team.manage'));

-- church_assets: everyone reads and uploads, only admin deletes.
drop policy if exists assets_select on public.church_assets;
create policy assets_select on public.church_assets for select
  using (public.church_can(church_id, 'library.view'));

drop policy if exists assets_insert on public.church_assets;
create policy assets_insert on public.church_assets for insert
  with check (public.church_can(church_id, 'asset.upload'));

drop policy if exists assets_update on public.church_assets;
create policy assets_update on public.church_assets for update
  using (public.church_can(church_id, 'asset.upload'))
  with check (public.church_can(church_id, 'asset.upload'));

drop policy if exists assets_delete on public.church_assets;
create policy assets_delete on public.church_assets for delete
  using (public.church_can(church_id, 'asset.delete'));

-- productions
drop policy if exists productions_select on public.productions;
create policy productions_select on public.productions for select
  using (public.is_church_member(church_id));

drop policy if exists productions_insert on public.productions;
create policy productions_insert on public.productions for insert
  with check (public.church_can(church_id, 'production.create'));

-- The status guard (approve/publish) is enforced in the API, which knows the
-- previous status. Here we only require edit rights on the row at all.
drop policy if exists productions_update on public.productions;
create policy productions_update on public.productions for update
  using (public.church_can(church_id, 'production.edit_script'))
  with check (public.church_can(church_id, 'production.edit_script'));

drop policy if exists productions_delete on public.productions;
create policy productions_delete on public.productions for delete
  using (public.church_can(church_id, 'asset.delete'));

-- production_comments: everyone comments, nobody edits someone else's comment.
drop policy if exists production_comments_select on public.production_comments;
create policy production_comments_select on public.production_comments for select
  using (public.is_church_member(church_id));

drop policy if exists production_comments_insert on public.production_comments;
create policy production_comments_insert on public.production_comments for insert
  with check (public.church_can(church_id, 'comment.write') and author_user_id = auth.uid());

drop policy if exists production_comments_delete on public.production_comments;
create policy production_comments_delete on public.production_comments for delete
  using (author_user_id = auth.uid() or public.church_can(church_id, 'team.manage'));

-- production_approvals: anyone who can edit requests; only approvers decide.
drop policy if exists production_approvals_select on public.production_approvals;
create policy production_approvals_select on public.production_approvals for select
  using (public.is_church_member(church_id));

drop policy if exists production_approvals_insert on public.production_approvals;
create policy production_approvals_insert on public.production_approvals for insert
  with check (public.church_can(church_id, 'production.edit_script'));

drop policy if exists production_approvals_update on public.production_approvals;
create policy production_approvals_update on public.production_approvals for update
  using (public.church_can(church_id, 'production.approve'))
  with check (public.church_can(church_id, 'production.approve'));

-- publish_targets: reading a target is harmless, wiring credentials is not.
drop policy if exists publish_targets_select on public.publish_targets;
create policy publish_targets_select on public.publish_targets for select
  using (public.is_church_member(church_id));

drop policy if exists publish_targets_write on public.publish_targets;
create policy publish_targets_write on public.publish_targets for all
  using (public.church_can(church_id, 'credentials.manage'))
  with check (public.church_can(church_id, 'credentials.manage'));

-- live_events
drop policy if exists live_events_select on public.live_events;
create policy live_events_select on public.live_events for select
  using (public.is_church_member(church_id));

drop policy if exists live_events_write on public.live_events;
create policy live_events_write on public.live_events for all
  using (public.church_can(church_id, 'live.control'))
  with check (public.church_can(church_id, 'live.control'));

-- calendar_entries: scheduling a publication is publishing.
drop policy if exists calendar_entries_select on public.calendar_entries;
create policy calendar_entries_select on public.calendar_entries for select
  using (public.is_church_member(church_id));

drop policy if exists calendar_entries_write on public.calendar_entries;
create policy calendar_entries_write on public.calendar_entries for all
  using (public.church_can(church_id, 'production.publish'))
  with check (public.church_can(church_id, 'production.publish'));
