-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 3 — RAG: enable pgvector + add embedding columns + similarity search RPCs
--
-- Vol. II §11 (RAG architecture). Embeddings prodotti con
-- text-embedding-3-small (1536 dim) via Lovable AI Gateway / OpenAI compat.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── kb_entries.embedding ─────────────────────────────────────────────────────
alter table public.kb_entries
  add column if not exists embedding vector(1536);

alter table public.kb_entries
  add column if not exists embedding_model text;

alter table public.kb_entries
  add column if not exists embedding_updated_at timestamptz;

-- IVFFlat index per cosine similarity. lists=100 ragionevole per <100k righe.
-- (Per oltre 1M righe, considerare HNSW.)
create index if not exists kb_entries_embedding_idx
  on public.kb_entries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── ai_memory.embedding ──────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'ai_memory') then
    execute 'alter table public.ai_memory add column if not exists embedding vector(1536)';
    execute 'alter table public.ai_memory add column if not exists embedding_model text';
    execute 'alter table public.ai_memory add column if not exists embedding_updated_at timestamptz';
    execute 'create index if not exists ai_memory_embedding_idx on public.ai_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100)';
  end if;
end $$;

-- ── RPC: match_kb_entries ────────────────────────────────────────────────────
-- Ritorna le KB entries più simili a un embedding query.
-- Filtri opzionali: categories[], min_priority, only_active.
create or replace function public.match_kb_entries(
  query_embedding vector(1536),
  match_count int default 10,
  match_threshold float default 0.0,
  filter_categories text[] default null,
  filter_min_priority int default 0,
  only_active boolean default true
)
returns table (
  id uuid,
  title text,
  content text,
  category text,
  chapter text,
  tags text[],
  priority int,
  similarity float
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    k.id,
    k.title,
    k.content,
    k.category,
    k.chapter,
    k.tags,
    k.priority,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.kb_entries k
  where
    k.embedding is not null
    and (only_active is false or k.is_active = true)
    and (filter_categories is null or k.category = any(filter_categories))
    and k.priority >= filter_min_priority
    and (1 - (k.embedding <=> query_embedding)) >= match_threshold
  order by k.embedding <=> query_embedding asc
  limit match_count;
end;
$$;

grant execute on function public.match_kb_entries(
  vector(1536), int, float, text[], int, boolean
) to authenticated, service_role;

-- ── RPC: match_ai_memory ─────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'ai_memory') then
    execute $f$
      create or replace function public.match_ai_memory(
        query_embedding vector(1536),
        match_count int default 5,
        match_threshold float default 0.0,
        filter_user_id uuid default null
      )
      returns table (
        id uuid,
        content text,
        memory_type text,
        created_at timestamptz,
        similarity float
      )
      language plpgsql
      stable
      security definer
      set search_path = public
      as $g$
      begin
        return query
        select
          m.id,
          m.content,
          m.memory_type,
          m.created_at,
          1 - (m.embedding <=> query_embedding) as similarity
        from public.ai_memory m
        where
          m.embedding is not null
          and (filter_user_id is null or m.user_id = filter_user_id)
          and (1 - (m.embedding <=> query_embedding)) >= match_threshold
        order by m.embedding <=> query_embedding asc
        limit match_count;
      end;
      $g$;
    $f$;
    execute 'grant execute on function public.match_ai_memory(vector(1536), int, float, uuid) to authenticated, service_role';
  end if;
end $$;

-- ── Backfill helper view: KB rows che hanno bisogno di embedding ─────────────
create or replace view public.kb_entries_pending_embedding as
select id, title, content, category
from public.kb_entries
where is_active = true
  and (embedding is null or embedding_updated_at is null);

comment on view public.kb_entries_pending_embedding is
  'Wave3 RAG — KB entries che necessitano (re)generation di embedding.';
