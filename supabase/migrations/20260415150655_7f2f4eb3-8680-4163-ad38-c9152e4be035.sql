
create table if not exists public.command_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  archived boolean not null default false
);

create table if not exists public.command_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.command_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  tool_id text,
  tool_result jsonb,
  created_at timestamptz not null default now()
);

create index ix_conversations_user on public.command_conversations(user_id, last_message_at desc);
create index ix_messages_conversation on public.command_messages(conversation_id, created_at);

alter table public.command_conversations enable row level security;
alter table public.command_messages enable row level security;

create policy "users_own_conversations" on public.command_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_messages" on public.command_messages
  for all using (
    exists (select 1 from public.command_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.command_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
