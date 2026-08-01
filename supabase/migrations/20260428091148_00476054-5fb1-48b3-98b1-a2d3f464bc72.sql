
-- agent_routing_rules: DB-driven persona-aware routing rules.
-- Replaces hardcoded classification/escalation logic with editable rules.

CREATE TABLE IF NOT EXISTS public.agent_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  -- nullable agent_id = global rule (applies when no persona-specific rule matches)
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  -- Match conditions (all evaluated AND-wise; missing = wildcard)
  match_domain TEXT,           -- commercial|operative|administrative|support|internal
  match_category TEXT,         -- VALID_CATEGORIES enum
  match_sentiment TEXT,        -- positive|negative|neutral|mixed
  match_lead_status TEXT,      -- new|first_touch_sent|holding|engaged|qualified|negotiation|converted|archived|blacklisted
  match_min_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.0,
  match_keywords TEXT[] NOT NULL DEFAULT '{}', -- any-match
  -- Bias to inject into classification prompt (soft suggestions)
  bias_domain_hint TEXT,
  bias_category_hint TEXT,
  bias_tone_hint TEXT,
  bias_extra_instructions TEXT,
  -- Hard overrides applied after classification
  override_next_status TEXT,           -- forza il next lead_status
  override_action_type TEXT,            -- forza action_type pending action
  override_priority TEXT,               -- low|normal|high|critical
  override_confidence_floor NUMERIC(3,2), -- alza la confidence se sotto soglia
  override_skip_action BOOLEAN NOT NULL DEFAULT false, -- non creare pending action
  -- Telemetry
  match_count INT NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arr_user ON public.agent_routing_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_arr_agent ON public.agent_routing_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_arr_enabled ON public.agent_routing_rules(enabled) WHERE enabled = true;

ALTER TABLE public.agent_routing_rules ENABLE ROW LEVEL SECURITY;

-- Visible globally to authenticated operators (mirrors agents/agent_personas pattern).
CREATE POLICY "Authenticated users can view routing rules"
  ON public.agent_routing_rules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert their own routing rules"
  ON public.agent_routing_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own routing rules"
  ON public.agent_routing_rules
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own routing rules"
  ON public.agent_routing_rules
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_arr_updated_at
  BEFORE UPDATE ON public.agent_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Increment match counter from edge functions (used after a rule fires).
CREATE OR REPLACE FUNCTION public.increment_routing_rule_match(_rule_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.agent_routing_rules
     SET match_count = match_count + 1,
         last_matched_at = now()
   WHERE id = _rule_id;
$$;
