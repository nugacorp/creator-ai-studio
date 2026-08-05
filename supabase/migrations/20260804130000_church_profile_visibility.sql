-- Team members must be able to see each other's names.
--
-- The original profiles policy is "select own", which is right for a
-- single-user tool but makes the team roster render as a list of UUIDs. This
-- widens it to people who share an active church membership with the caller.
--
-- The lookup goes through a SECURITY DEFINER function on purpose: querying
-- church_members directly from a profiles policy would re-enter that table's
-- own RLS and recurse.

create or replace function public.shares_church_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_self_or_church_peer" on public.profiles;
create policy "profiles_select_self_or_church_peer"
  on public.profiles for select
  using (id = auth.uid() or public.shares_church_with(id));
