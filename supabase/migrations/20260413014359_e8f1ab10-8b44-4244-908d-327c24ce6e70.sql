
-- Add embedding columns to ai_memory
ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- Add feedback column
ALTER TABLE public.ai_memory ADD COLUMN IF NOT EXISTS feedback text CHECK (feedback IN ('positive', 'negative'));

-- Create index for vector search
CREATE INDEX IF NOT EXISTS idx_ai_memory_embedding ON public.ai_memory USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 50);

-- Create enhanced memory matching function
CREATE OR REPLACE FUNCTION public.match_ai_memory_enhanced(
  query_embedding extensions.vector(1536),
  match_count int default 15,
  match_threshold float default 0.2,
  filter_user_id uuid default null,
  filter_levels int[] default null,
  filter_types text[] default null
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  level smallint,
  importance int,
  confidence numeric,
  tags text[],
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
    m.id,
    m.content,
    m.memory_type,
    m.level,
    m.importance,
    m.confidence,
    m.tags,
    (1 - (m.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_memory m
  WHERE m.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR m.user_id = filter_user_id)
    AND (filter_levels IS NULL OR m.level = ANY(filter_levels))
    AND (filter_types IS NULL OR m.memory_type = ANY(filter_types))
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND (1 - (m.embedding <=> query_embedding)) >= match_threshold
  ORDER BY m.level DESC, (1 - (m.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_ai_memory_enhanced TO authenticated, service_role;

-- Create view for pending embeddings
CREATE OR REPLACE VIEW public.ai_memory_pending_embedding AS
SELECT id, content, memory_type, level, created_at
FROM public.ai_memory
WHERE embedding IS NULL OR embedding_updated_at IS NULL
ORDER BY level DESC, created_at DESC;
