-- Add metadata jsonb to prompt_test_runs for telemetry
-- (identity_loaded, kb_snippets_count, language_used, system_prompt, etc.)
ALTER TABLE public.prompt_test_runs
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
