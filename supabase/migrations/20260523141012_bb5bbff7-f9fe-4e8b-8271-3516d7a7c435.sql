
-- F4 fix: agent_routing_rules NON è deprecato (regole globali).
COMMENT ON TABLE public.agent_routing_rules IS
  'Regole di routing GLOBALI per la classificazione AI (agent_id NULL = applicate a tutti). Le regole per singolo agente vivono in agent_capabilities.routing_rules.';

-- ai_routing_config resta deprecato, già commentato in migration precedente.
