-- Versioning esplicito prompt
ALTER TABLE public.operative_prompts
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.operative_prompts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_operative_prompts_superseded ON public.operative_prompts(superseded_by) WHERE superseded_by IS NOT NULL;

-- Correlazione outcome
ALTER TABLE public.brand_voice_audits
  ADD COLUMN IF NOT EXISTS outreach_message_id uuid;
CREATE INDEX IF NOT EXISTS idx_brand_voice_audits_outreach ON public.brand_voice_audits(outreach_message_id) WHERE outreach_message_id IS NOT NULL;

-- Vista aggregata score per canale e ruolo (ultimi 30gg)
CREATE OR REPLACE VIEW public.v_brand_voice_outcomes
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at)::date AS day,
  channel,
  journalist_role,
  count(*)::int AS audits,
  round(avg(brand_voice_score)::numeric, 1) AS avg_score,
  count(*) FILTER (WHERE brand_voice_score < 60)::int AS low_score_count,
  count(*) FILTER (WHERE brand_voice_score >= 80)::int AS high_score_count
FROM public.brand_voice_audits
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;

GRANT SELECT ON public.v_brand_voice_outcomes TO authenticated;
