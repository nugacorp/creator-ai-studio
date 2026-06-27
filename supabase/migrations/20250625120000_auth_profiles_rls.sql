-- Creator AI Studio — user auth, profiles, and row-level security

-- Extend core tables with ownership
alter table public.episodes
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.channels
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.production_jobs
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists idx_episodes_user_id on public.episodes (user_id);
create index if not exists idx_channels_user_id on public.channels (user_id);
create index if not exists idx_jobs_user_id on public.production_jobs (user_id);

-- Public profile per auth user
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- RLS: episodes
alter table public.episodes enable row level security;

drop policy if exists "episodes_select_own" on public.episodes;
create policy "episodes_select_own"
  on public.episodes for select
  using (auth.uid() = user_id);

drop policy if exists "episodes_insert_own" on public.episodes;
create policy "episodes_insert_own"
  on public.episodes for insert
  with check (auth.uid() = user_id);

drop policy if exists "episodes_update_own" on public.episodes;
create policy "episodes_update_own"
  on public.episodes for update
  using (auth.uid() = user_id);

drop policy if exists "episodes_delete_own" on public.episodes;
create policy "episodes_delete_own"
  on public.episodes for delete
  using (auth.uid() = user_id);

-- RLS: channels
alter table public.channels enable row level security;

drop policy if exists "channels_all_own" on public.channels;
create policy "channels_all_own"
  on public.channels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS: production_jobs (via episode ownership)
alter table public.production_jobs enable row level security;

drop policy if exists "jobs_select_own" on public.production_jobs;
create policy "jobs_select_own"
  on public.production_jobs for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.episodes e
      where e.id = production_jobs.episode_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "jobs_insert_own" on public.production_jobs;
create policy "jobs_insert_own"
  on public.production_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "jobs_update_own" on public.production_jobs;
create policy "jobs_update_own"
  on public.production_jobs for update
  using (auth.uid() = user_id);
