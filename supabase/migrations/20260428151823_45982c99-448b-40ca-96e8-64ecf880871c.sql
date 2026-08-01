create table if not exists public.ai_scope_registry (
  scope text primary key,
  description text not null,
  enforcement_mode text not null check (enforcement_mode in ('block','warn')) default 'warn',
  requires_grounding boolean not null default false,
  allowed_tools text[] default null,
  updated_at timestamptz not null default now()
);

alter table public.ai_scope_registry enable row level security;

drop policy if exists "ai_scope_registry_read_authenticated" on public.ai_scope_registry;
create policy "ai_scope_registry_read_authenticated"
on public.ai_scope_registry for select
to authenticated using (true);

drop policy if exists "ai_scope_registry_admin_write" on public.ai_scope_registry;
create policy "ai_scope_registry_admin_write"
on public.ai_scope_registry for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.ai_scope_registry (scope, description, enforcement_mode, requires_grounding) values
  ('home',      'Home dashboard chat — query su entità (partner/paesi/stats)', 'block', true),
  ('partners',  'Partner Hub — azioni su partner verificati',                  'block', true),
  ('missions',  'Mission Builder — proposte basate su segmenti reali',         'block', true),
  ('outreach',  'Outreach/A-B test — generazione email su strategy rules',     'block', true),
  ('crm',       'CRM operations — lead/score/duplicates',                       'block', true),
  ('staff',     'Staff direzionale — performance team',                         'warn',  true),
  ('strategic', 'Strategic chat — ragionamenti aperti',                         'warn',  false),
  ('command',   'Command palette — commento risultato tool',                    'warn',  false),
  ('email',     'Email composer — generazione/improve email',                   'block', true),
  ('classify',  'Classificazione email/messaggi inbound',                       'block', true),
  ('agent',     'Agent execution loop',                                         'block', true),
  ('sherlock',  'Deep search Sherlock — verifica esistenza',                    'block', true),
  ('lab',       'AI Lab/Prompt Lab/Simulator — test interni',                   'warn',  false),
  ('diagnostics','Diagnostica edge function',                                    'warn',  false),
  ('briefing',  'Daily briefing operativo',                                     'warn',  true)
on conflict (scope) do nothing;

create table if not exists public.ai_invocation_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  scope text,
  function_name text not null,
  context_source text,
  enforcement_mode text,
  grounded boolean,
  tool_calls_count integer default 0,
  blocked boolean default false,
  block_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_invocation_audit_created on public.ai_invocation_audit(created_at desc);
create index if not exists idx_ai_invocation_audit_scope on public.ai_invocation_audit(scope, created_at desc);

alter table public.ai_invocation_audit enable row level security;

drop policy if exists "ai_invocation_audit_read_admin" on public.ai_invocation_audit;
create policy "ai_invocation_audit_read_admin"
on public.ai_invocation_audit for select
to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "ai_invocation_audit_insert_authenticated" on public.ai_invocation_audit;
create policy "ai_invocation_audit_insert_authenticated"
on public.ai_invocation_audit for insert
to authenticated with check (true);