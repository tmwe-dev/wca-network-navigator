create table public.harmonizer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_file text not null,
  source_kind text not null default 'library',
  total_chunks integer not null,
  current_chunk integer not null default 0,
  status text not null default 'pending',
  facts_registry jsonb not null default '{}'::jsonb,
  conflicts_found jsonb not null default '[]'::jsonb,
  cross_references jsonb not null default '[]'::jsonb,
  entities_created jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  harmonize_run_id uuid references public.harmonize_runs(id) on delete set null,
  started_at timestamptz default now(),
  last_chunk_completed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.harmonizer_sessions enable row level security;

create policy "Users manage own harmonizer sessions"
  on public.harmonizer_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_harmonizer_sessions_user_active
  on public.harmonizer_sessions (user_id, updated_at desc)
  where status in ('pending','in_progress');

create trigger trg_harmonizer_sessions_updated_at
  before update on public.harmonizer_sessions
  for each row execute function public.update_updated_at_column();