-- Sprint H.4 — Enrich ai_interaction_log with observability columns.
-- Uses ADD COLUMN IF NOT EXISTS so the migration is re-runnable.

ALTER TABLE ai_interaction_log ADD COLUMN IF NOT EXISTS latency_ms integer;
ALTER TABLE ai_interaction_log ADD COLUMN IF NOT EXISTS tokens_input integer;
ALTER TABLE ai_interaction_log ADD COLUMN IF NOT EXISTS tokens_output integer;
ALTER TABLE ai_interaction_log ADD COLUMN IF NOT EXISTS cost_estimate_usd numeric(10,6);
ALTER TABLE ai_interaction_log ADD COLUMN IF NOT EXISTS model_used text;

COMMENT ON COLUMN ai_interaction_log.latency_ms IS 'Total wall-clock latency of the AI call in milliseconds';
COMMENT ON COLUMN ai_interaction_log.tokens_input IS 'Input / prompt token count returned by the model provider';
COMMENT ON COLUMN ai_interaction_log.tokens_output IS 'Output / completion token count returned by the model provider';
COMMENT ON COLUMN ai_interaction_log.cost_estimate_usd IS 'Estimated cost in USD based on token counts and pricing table';
COMMENT ON COLUMN ai_interaction_log.model_used IS 'Model identifier used for this interaction (e.g. gpt-4o, claude-sonnet)';
