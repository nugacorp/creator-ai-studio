-- Creator AI Studio — initial Supabase schema (optional Phase 2+)

create table if not exists episodes (
  id uuid primary key,
  slug text not null,
  title text not null,
  status text not null default 'draft',
  workspace_path text,
  content jsonb not null default '{}',
  stages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  status text not null default 'Produciendo',
  subscribers integer not null default 0,
  avatar text not null default '📺',
  created_at timestamptz not null default now()
);

create table if not exists production_jobs (
  id uuid primary key,
  episode_id uuid references episodes(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending',
  progress integer not null default 0,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_episodes_status on episodes(status);
create index if not exists idx_jobs_episode on production_jobs(episode_id);
create index if not exists idx_jobs_status on production_jobs(status);
