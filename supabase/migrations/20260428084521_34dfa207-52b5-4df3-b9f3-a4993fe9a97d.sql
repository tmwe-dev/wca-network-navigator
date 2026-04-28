-- Tabella agent_capabilities (1:1 con agents)
CREATE TABLE public.agent_capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL DEFAULT public.get_current_operator_id(),

  -- Tool governance
  allowed_tools TEXT[] NOT NULL DEFAULT '{}'::text[],
  blocked_tools TEXT[] NOT NULL DEFAULT '{}'::text[],
  approval_required_tools TEXT[] NOT NULL DEFAULT '{}'::text[],

  -- Runtime limits
  max_concurrent_tools INTEGER NOT NULL DEFAULT 3 CHECK (max_concurrent_tools BETWEEN 1 AND 25),
  step_timeout_ms INTEGER NOT NULL DEFAULT 25000 CHECK (step_timeout_ms BETWEEN 1000 AND 120000),
  max_iterations INTEGER NOT NULL DEFAULT 12 CHECK (max_iterations BETWEEN 1 AND 50),
  max_tokens_per_call INTEGER NOT NULL DEFAULT 1500 CHECK (max_tokens_per_call BETWEEN 100 AND 16000),
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.20 CHECK (temperature BETWEEN 0 AND 2),

  -- Model & mode
  preferred_model TEXT,
  execution_mode TEXT NOT NULL DEFAULT 'supervised'
    CHECK (execution_mode IN ('autonomous','supervised','read_only')),

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_capabilities_agent ON public.agent_capabilities(agent_id);
CREATE INDEX idx_agent_capabilities_operator ON public.agent_capabilities(operator_id) WHERE operator_id IS NOT NULL;
CREATE INDEX idx_agent_capabilities_user ON public.agent_capabilities(user_id);

ALTER TABLE public.agent_capabilities ENABLE ROW LEVEL SECURITY;

-- SELECT globale per operatori autenticati (allineato a policy "Visibilità Globale Agenti")
CREATE POLICY "agent_capabilities_select_all_authenticated"
  ON public.agent_capabilities FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: solo proprietario (allineato ad agent_personas)
CREATE POLICY "agent_capabilities_insert_own"
  ON public.agent_capabilities FOR INSERT
  TO authenticated
  WITH CHECK (operator_id IS NULL OR operator_id = ANY (public.get_effective_operator_ids()));

CREATE POLICY "agent_capabilities_update_own"
  ON public.agent_capabilities FOR UPDATE
  TO authenticated
  USING (operator_id IS NULL OR operator_id = ANY (public.get_effective_operator_ids()))
  WITH CHECK (operator_id IS NULL OR operator_id = ANY (public.get_effective_operator_ids()));

CREATE POLICY "agent_capabilities_delete_own"
  ON public.agent_capabilities FOR DELETE
  TO authenticated
  USING (operator_id IS NULL OR operator_id = ANY (public.get_effective_operator_ids()));

-- Trigger updated_at
CREATE TRIGGER update_agent_capabilities_updated_at
  BEFORE UPDATE ON public.agent_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: auto-crea capabilities di default quando nasce un agente
CREATE OR REPLACE FUNCTION public.create_default_agent_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agent_capabilities (agent_id, user_id, operator_id)
  VALUES (NEW.id, NEW.user_id, public.get_current_operator_id())
  ON CONFLICT (agent_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agents_default_capabilities
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_agent_capabilities();

-- Backfill: una riga di default per ogni agente già esistente
INSERT INTO public.agent_capabilities (agent_id, user_id)
SELECT a.id, a.user_id
FROM public.agents a
WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_capabilities c WHERE c.agent_id = a.id
);