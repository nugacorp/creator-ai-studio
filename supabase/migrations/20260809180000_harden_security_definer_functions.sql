-- Creator AI Studio — harden SECURITY DEFINER functions exposed by Supabase/PostgREST
--
-- Fixes Supabase database linter warnings:
-- - function_search_path_mutable for trigger functions.
-- - anon/authenticated can execute SECURITY DEFINER functions via /rest/v1/rpc.
--
-- Strategy:
-- 1. Pin search_path on trigger functions.
-- 2. Move RLS helper functions used by policies to a non-exposed `private` schema.
-- 3. Recreate policies to reference `private.*` helpers.
-- 4. Drop/revoke exposed public RPC-capable helper functions.
-- 5. Revoke direct EXECUTE on trigger-only SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- 1. Pin mutable search_path on trigger functions
-- ---------------------------------------------------------------------------

alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.church_assets_refresh_search()
  set search_path = public, pg_temp;

-- Trigger-only functions do not need RPC access.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.church_assets_refresh_search() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.grant_creator_admin_membership() from public, anon, authenticated;

-- Ensure trigger SECURITY DEFINER functions also have immutable search_path.
alter function public.handle_new_user()
  set search_path = public, pg_temp;

alter function public.grant_creator_admin_membership()
  set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Private RLS helper schema/functions
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.church_role(p_church_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.church_members m
  where m.church_id = p_church_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1
$$;

create or replace function private.is_church_member(p_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.church_role(p_church_id) is not null
$$;

create or replace function private.church_can(p_church_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
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
  from (select private.church_role(p_church_id) as r) role_lookup
$$;

create or replace function private.shares_church_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.church_members me
    join public.church_members peer on peer.church_id = me.church_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and peer.user_id = p_user_id
      and peer.status = 'active'
  )
$$;

-- Keep helpers usable by RLS policy expressions while avoiding PostgREST RPC
-- exposure. The `private` schema is not in the exposed API schema list, so
-- these functions are not callable through `/rest/v1/rpc/*` even though the
-- roles can execute them during policy evaluation.
grant usage on schema private to anon, authenticated;
grant execute on function private.church_role(uuid) to anon, authenticated;
grant execute on function private.is_church_member(uuid) to anon, authenticated;
grant execute on function private.church_can(uuid, text) to anon, authenticated;
grant execute on function private.shares_church_with(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Recreate policies against private helpers
-- ---------------------------------------------------------------------------

-- profiles

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_self_or_church_peer" on public.profiles;
create policy "profiles_select_self_or_church_peer"
  on public.profiles for select
  using (id = auth.uid() or private.shares_church_with(id));

-- churches

drop policy if exists churches_select on public.churches;
create policy churches_select on public.churches for select
  using (private.is_church_member(id));

drop policy if exists churches_insert on public.churches;
create policy churches_insert on public.churches for insert
  with check (auth.uid() is not null and created_by_user_id = auth.uid());

drop policy if exists churches_update on public.churches;
create policy churches_update on public.churches for update
  using (private.church_can(id, 'team.manage'))
  with check (private.church_can(id, 'team.manage'));

drop policy if exists churches_delete on public.churches;
create policy churches_delete on public.churches for delete
  using (private.church_can(id, 'team.manage'));

-- church_members

drop policy if exists members_select on public.church_members;
create policy members_select on public.church_members for select
  using (user_id = auth.uid() or private.is_church_member(church_id));

drop policy if exists members_insert on public.church_members;
create policy members_insert on public.church_members for insert
  with check (private.church_can(church_id, 'team.manage'));

drop policy if exists members_update on public.church_members;
create policy members_update on public.church_members for update
  using (private.church_can(church_id, 'team.manage'))
  with check (private.church_can(church_id, 'team.manage'));

drop policy if exists members_delete on public.church_members;
create policy members_delete on public.church_members for delete
  using (private.church_can(church_id, 'team.manage'));

-- ministries

drop policy if exists ministries_select on public.ministries;
create policy ministries_select on public.ministries for select
  using (private.is_church_member(church_id));

drop policy if exists ministries_write on public.ministries;
create policy ministries_write on public.ministries for all
  using (private.church_can(church_id, 'team.manage'))
  with check (private.church_can(church_id, 'team.manage'));

-- church_assets

drop policy if exists assets_select on public.church_assets;
create policy assets_select on public.church_assets for select
  using (private.church_can(church_id, 'library.view'));

drop policy if exists assets_insert on public.church_assets;
create policy assets_insert on public.church_assets for insert
  with check (private.church_can(church_id, 'asset.upload'));

drop policy if exists assets_update on public.church_assets;
create policy assets_update on public.church_assets for update
  using (private.church_can(church_id, 'asset.upload'))
  with check (private.church_can(church_id, 'asset.upload'));

drop policy if exists assets_delete on public.church_assets;
create policy assets_delete on public.church_assets for delete
  using (private.church_can(church_id, 'asset.delete'));

-- productions

drop policy if exists productions_select on public.productions;
create policy productions_select on public.productions for select
  using (private.is_church_member(church_id));

drop policy if exists productions_insert on public.productions;
create policy productions_insert on public.productions for insert
  with check (private.church_can(church_id, 'production.create'));

drop policy if exists productions_update on public.productions;
create policy productions_update on public.productions for update
  using (private.church_can(church_id, 'production.edit_script'))
  with check (private.church_can(church_id, 'production.edit_script'));

drop policy if exists productions_delete on public.productions;
create policy productions_delete on public.productions for delete
  using (private.church_can(church_id, 'asset.delete'));

-- production_comments

drop policy if exists production_comments_select on public.production_comments;
create policy production_comments_select on public.production_comments for select
  using (private.is_church_member(church_id));

drop policy if exists production_comments_insert on public.production_comments;
create policy production_comments_insert on public.production_comments for insert
  with check (private.church_can(church_id, 'comment.write') and author_user_id = auth.uid());

drop policy if exists production_comments_delete on public.production_comments;
create policy production_comments_delete on public.production_comments for delete
  using (author_user_id = auth.uid() or private.church_can(church_id, 'team.manage'));

-- production_approvals

drop policy if exists production_approvals_select on public.production_approvals;
create policy production_approvals_select on public.production_approvals for select
  using (private.is_church_member(church_id));

drop policy if exists production_approvals_insert on public.production_approvals;
create policy production_approvals_insert on public.production_approvals for insert
  with check (private.church_can(church_id, 'production.edit_script'));

drop policy if exists production_approvals_update on public.production_approvals;
create policy production_approvals_update on public.production_approvals for update
  using (private.church_can(church_id, 'production.approve'))
  with check (private.church_can(church_id, 'production.approve'));

-- publish_targets

drop policy if exists publish_targets_select on public.publish_targets;
create policy publish_targets_select on public.publish_targets for select
  using (private.is_church_member(church_id));

drop policy if exists publish_targets_write on public.publish_targets;
create policy publish_targets_write on public.publish_targets for all
  using (private.church_can(church_id, 'credentials.manage'))
  with check (private.church_can(church_id, 'credentials.manage'));

-- live_events

drop policy if exists live_events_select on public.live_events;
create policy live_events_select on public.live_events for select
  using (private.is_church_member(church_id));

drop policy if exists live_events_write on public.live_events;
create policy live_events_write on public.live_events for all
  using (private.church_can(church_id, 'live.control'))
  with check (private.church_can(church_id, 'live.control'));

-- calendar_entries

drop policy if exists calendar_entries_select on public.calendar_entries;
create policy calendar_entries_select on public.calendar_entries for select
  using (private.is_church_member(church_id));

drop policy if exists calendar_entries_write on public.calendar_entries;
create policy calendar_entries_write on public.calendar_entries for all
  using (private.church_can(church_id, 'production.publish'))
  with check (private.church_can(church_id, 'production.publish'));

-- ---------------------------------------------------------------------------
-- 4. Remove public RPC attack surface for helper functions
-- ---------------------------------------------------------------------------

-- Drop public helper functions after all policies have been moved to private.*.
drop function if exists public.church_can(uuid, text);
drop function if exists public.is_church_member(uuid);
drop function if exists public.church_role(uuid);
drop function if exists public.shares_church_with(uuid);
