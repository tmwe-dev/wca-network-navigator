
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding columns to kb_entries
ALTER TABLE public.kb_entries
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_kb_entries_embedding
  ON public.kb_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Create the match_kb_entries RPC function for RAG retrieval
CREATE OR REPLACE FUNCTION public.match_kb_entries(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  match_threshold float DEFAULT 0.3,
  filter_categories text[] DEFAULT NULL,
  filter_min_priority int DEFAULT 0,
  only_active boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  chapter text,
  tags text[],
  priority int,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.title,
    ke.content,
    ke.category,
    ke.chapter,
    ke.tags,
    ke.priority,
    (1 - (ke.embedding <=> query_embedding))::float AS similarity
  FROM public.kb_entries ke
  WHERE ke.embedding IS NOT NULL
    AND (NOT only_active OR ke.is_active = true)
    AND ke.priority >= filter_min_priority
    AND (filter_categories IS NULL OR ke.category = ANY(filter_categories))
    AND (1 - (ke.embedding <=> query_embedding)) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
