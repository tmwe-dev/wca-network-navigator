
-- F4 — Collasso routing nel cervello unico
-- 1) agent_capabilities: aggiungo colonna routing_rules per ospitare le regole per-agente
ALTER TABLE public.agent_capabilities
  ADD COLUMN IF NOT EXISTS routing_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.agent_capabilities.routing_rules IS
  'F4 2026-05-23: regole di routing per agente migrate da agent_routing_rules. Array di oggetti {name, priority, enabled, match: {...}, override: {...}, bias: {...}}.';

-- 2) View read-only per esporre ai_routing_config (sostituisce hub legacy)
CREATE OR REPLACE VIEW public.v_ai_routing_config
WITH (security_invoker = true)
AS
SELECT
  scope,
  tier,
  provider,
  model,
  notes,
  updated_at,
  updated_by
FROM public.ai_routing_config;

GRANT SELECT ON public.v_ai_routing_config TO authenticated;

-- 3) Marcatura deprecazione (la DROP avverrà in F7 dopo 30gg di osservazione)
COMMENT ON TABLE public.agent_routing_rules IS
  'DEPRECATED 2026-05-23 (F4): regole migrate in agent_capabilities.routing_rules. Drop pianificata in F7.';
COMMENT ON TABLE public.ai_routing_config IS
  'DEPRECATED 2026-05-23 (F4): esposta via v_ai_routing_config. Resta intoccata, drop non pianificata.';
