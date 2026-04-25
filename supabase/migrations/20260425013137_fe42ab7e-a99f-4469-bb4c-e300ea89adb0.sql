ALTER TABLE public.harmonizer_sessions
  ADD COLUMN IF NOT EXISTS last_processed_entity_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agentic_mode boolean NOT NULL DEFAULT false;