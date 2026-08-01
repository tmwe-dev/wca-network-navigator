-- 1a. Memoria dell'agente
CREATE TABLE IF NOT EXISTS public.scraper_agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE
    DEFAULT public.get_current_operator_id(),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'linkedin')),
  page_type text NOT NULL CHECK (page_type IN ('sidebar', 'thread', 'inbox', 'messaging')),
  extraction_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_version int NOT NULL DEFAULT 1,
  dom_structure_hash text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_successes int NOT NULL DEFAULT 0,
  consecutive_failures int NOT NULL DEFAULT 0,
  total_invocations int NOT NULL DEFAULT 0,
  total_ai_calls int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, channel, page_type)
);

CREATE INDEX IF NOT EXISTS idx_sam_operator_channel
  ON public.scraper_agent_memory(operator_id, channel);

-- 1b. Log invocazioni
CREATE TABLE IF NOT EXISTS public.scraper_agent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid REFERENCES public.scraper_agent_memory(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE
    DEFAULT public.get_current_operator_id(),
  channel text NOT NULL,
  page_type text NOT NULL,
  dom_snapshot_hash text,
  dom_snapshot_size int,
  screenshot_included boolean DEFAULT false,
  used_cached_plan boolean NOT NULL DEFAULT false,
  extraction_plan jsonb,
  ai_model text,
  ai_tokens_in int,
  ai_tokens_out int,
  ai_latency_ms int,
  execution_result text CHECK (execution_result IN ('success', 'partial', 'failure', 'retry_success')),
  items_found int DEFAULT 0,
  items_extracted int DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sal_operator_created
  ON public.scraper_agent_log(operator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sal_memory
  ON public.scraper_agent_log(memory_id, created_at DESC);

-- 1c. RLS
ALTER TABLE public.scraper_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_agent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sam_select_own ON public.scraper_agent_memory FOR SELECT TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY sam_insert_own ON public.scraper_agent_memory FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY sam_update_own ON public.scraper_agent_memory FOR UPDATE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY sam_delete_own ON public.scraper_agent_memory FOR DELETE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY sal_select_own ON public.scraper_agent_log FOR SELECT TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY sal_insert_own ON public.scraper_agent_log FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(public.get_effective_operator_ids()));

-- 1d. Trigger updated_at
DROP TRIGGER IF EXISTS trg_sam_updated ON public.scraper_agent_memory;
CREATE TRIGGER trg_sam_updated BEFORE UPDATE ON public.scraper_agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();