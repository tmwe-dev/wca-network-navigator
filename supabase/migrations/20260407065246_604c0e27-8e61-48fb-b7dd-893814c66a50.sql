
-- Add tiered memory columns to ai_memory
ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3) NOT NULL DEFAULT 0.500,
  ADD COLUMN IF NOT EXISTS decay_rate numeric(5,4) NOT NULL DEFAULT 0.0200,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pending_promotion boolean NOT NULL DEFAULT false;

-- Index for efficient tiered queries
CREATE INDEX IF NOT EXISTS idx_ai_memory_level_confidence ON public.ai_memory (user_id, level, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memory_pending_promotion ON public.ai_memory (user_id, pending_promotion) WHERE pending_promotion = true;
