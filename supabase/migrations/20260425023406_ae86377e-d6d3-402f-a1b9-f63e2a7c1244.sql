
-- Ricrea la vista riconciliazione con security_invoker=on (rispetta RLS del chiamante)
DROP VIEW IF EXISTS public.ai_usage_reconciliation;
CREATE VIEW public.ai_usage_reconciliation
WITH (security_invoker = true)
AS
WITH p AS (
  SELECT
    (created_at AT TIME ZONE 'UTC')::date AS day,
    user_id,
    provider,
    SUM(cost_usd)    AS prompt_log_cost,
    SUM(tokens_in)   AS prompt_log_tokens_in,
    COUNT(id)        AS prompt_log_calls
  FROM public.ai_prompt_log
  GROUP BY 1,2,3
),
u AS (
  SELECT
    (created_at AT TIME ZONE 'UTC')::date AS day,
    user_id,
    SUM(cost_estimate) AS api_usage_cost,
    SUM(input_tokens)  AS api_usage_tokens_in,
    COUNT(id)          AS api_usage_calls
  FROM public.ai_token_usage
  GROUP BY 1,2
)
SELECT
  COALESCE(p.day, u.day) AS day,
  COALESCE(p.user_id, u.user_id) AS user_id,
  p.provider,
  p.prompt_log_cost,
  p.prompt_log_tokens_in,
  p.prompt_log_calls,
  u.api_usage_cost,
  u.api_usage_tokens_in,
  u.api_usage_calls
FROM p FULL OUTER JOIN u
  ON p.day = u.day AND p.user_id = u.user_id;

-- Stringe la policy INSERT: ammette solo l'utente proprietario.
-- Il logging automatico dal backend usa service-role key, dove RLS non si applica.
DROP POLICY IF EXISTS "ai_prompt_log_insert_any" ON public.ai_prompt_log;
CREATE POLICY "ai_prompt_log_insert_self" ON public.ai_prompt_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
