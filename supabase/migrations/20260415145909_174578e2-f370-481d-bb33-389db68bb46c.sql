-- Add source_path column for KB file tracking
ALTER TABLE public.kb_entries ADD COLUMN IF NOT EXISTS source_path text;

-- Unique constraint for upsert by source_path
ALTER TABLE public.kb_entries ADD CONSTRAINT kb_entries_source_path_unique UNIQUE (source_path);

-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index on category
CREATE INDEX IF NOT EXISTS ix_kb_category ON public.kb_entries (category);

-- GIN index on tags
CREATE INDEX IF NOT EXISTS ix_kb_tags ON public.kb_entries USING GIN (tags);

-- Trigram index on title for fuzzy search
CREATE INDEX IF NOT EXISTS ix_kb_title_trgm ON public.kb_entries USING GIN (title gin_trgm_ops);

-- Full-text search index on content (Italian config)
CREATE INDEX IF NOT EXISTS ix_kb_content_fts ON public.kb_entries USING GIN (to_tsvector('italian', content));