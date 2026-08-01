
-- =====================================================================
-- AI Monitor — Dashboard Costi AI: tabelle, RPC, vista riconciliazione
-- =====================================================================

-- 1) ai_prompt_log: log granulare di OGNI singola chiamata AI
CREATE TABLE IF NOT EXISTS public.ai_prompt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,

  function_name TEXT NOT NULL,
  scope TEXT,
  action TEXT,
  group_category TEXT NOT NULL DEFAULT 'altro',

  provider TEXT NOT NULL DEFAULT 'google',
  model TEXT NOT NULL DEFAULT 'unknown',

  system_prompt_chars INTEGER NOT NULL DEFAULT 0,
  user_prompt_chars   INTEGER NOT NULL DEFAULT 0,
  context_chars       INTEGER NOT NULL DEFAULT 0,
  total_input_chars   INTEGER NOT NULL DEFAULT 0,

  tokens_in    INTEGER NOT NULL DEFAULT 0,
  tokens_out   INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER NOT NULL DEFAULT 0,

  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,

  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  is_cron BOOLEAN NOT NULL DEFAULT false,
  cron_job_name TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_log_user      ON public.ai_prompt_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_log_group     ON public.ai_prompt_log(group_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_log_function  ON public.ai_prompt_log(function_name, created_at DESC);
-- Per query "today/by day" usiamo (created_at, user_id) — DATE() non è IMMUTABLE in PG.
CREATE INDEX IF NOT EXISTS idx_prompt_log_user_created ON public.ai_prompt_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_log_cron      ON public.ai_prompt_log(is_cron, created_at DESC);

ALTER TABLE public.ai_prompt_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_prompt_log_select_own"  ON public.ai_prompt_log;
DROP POLICY IF EXISTS "ai_prompt_log_select_admin" ON public.ai_prompt_log;
DROP POLICY IF EXISTS "ai_prompt_log_insert_any"  ON public.ai_prompt_log;

CREATE POLICY "ai_prompt_log_select_own" ON public.ai_prompt_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_prompt_log_select_admin" ON public.ai_prompt_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "ai_prompt_log_insert_any" ON public.ai_prompt_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2) ai_budget_config: budget mensile e finestra abbonamento per utente
CREATE TABLE IF NOT EXISTS public.ai_budget_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  subscription_start DATE NOT NULL DEFAULT (date_trunc('month', now())::date),
  subscription_end   DATE,
  monthly_budget_usd NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_budget_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_budget_config_owner_all" ON public.ai_budget_config;
CREATE POLICY "ai_budget_config_owner_all" ON public.ai_budget_config
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_ai_budget_config_updated_at ON public.ai_budget_config;
CREATE TRIGGER trg_ai_budget_config_updated_at
  BEFORE UPDATE ON public.ai_budget_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) log_ai_prompt(): RPC unico per scrivere su ai_prompt_log
CREATE OR REPLACE FUNCTION public.log_ai_prompt(
  p_user_id UUID,
  p_function_name TEXT,
  p_scope TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_group_category TEXT DEFAULT 'altro',
  p_provider TEXT DEFAULT 'google',
  p_model TEXT DEFAULT 'unknown',
  p_system_prompt_chars INTEGER DEFAULT 0,
  p_user_prompt_chars INTEGER DEFAULT 0,
  p_context_chars INTEGER DEFAULT 0,
  p_tokens_in INTEGER DEFAULT 0,
  p_tokens_out INTEGER DEFAULT 0,
  p_cost_usd NUMERIC DEFAULT 0,
  p_latency_ms INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_is_cron BOOLEAN DEFAULT false,
  p_cron_job_name TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.ai_prompt_log (
    user_id, operator_id, function_name, scope, action, group_category,
    provider, model,
    system_prompt_chars, user_prompt_chars, context_chars, total_input_chars,
    tokens_in, tokens_out, tokens_total,
    cost_usd, latency_ms, success, error_message,
    is_cron, cron_job_name, metadata
  ) VALUES (
    p_user_id, p_operator_id, p_function_name, p_scope, p_action, COALESCE(p_group_category, 'altro'),
    COALESCE(p_provider, 'google'), COALESCE(p_model, 'unknown'),
    COALESCE(p_system_prompt_chars,0), COALESCE(p_user_prompt_chars,0), COALESCE(p_context_chars,0),
    COALESCE(p_system_prompt_chars,0) + COALESCE(p_user_prompt_chars,0) + COALESCE(p_context_chars,0),
    COALESCE(p_tokens_in,0), COALESCE(p_tokens_out,0), COALESCE(p_tokens_in,0) + COALESCE(p_tokens_out,0),
    COALESCE(p_cost_usd,0), p_latency_ms, COALESCE(p_success,true), p_error_message,
    COALESCE(p_is_cron,false), p_cron_job_name, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_ai_prompt(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC,
  INTEGER, BOOLEAN, TEXT, BOOLEAN, TEXT, UUID, JSONB
) TO authenticated, service_role;

-- 4) RPC aggregate per la dashboard
CREATE OR REPLACE FUNCTION public.get_today_by_group(p_user_id UUID)
RETURNS TABLE (
  group_category TEXT,
  calls BIGINT,
  total_tokens_in BIGINT,
  total_tokens_out BIGINT,
  total_cost NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.group_category,
    COUNT(*)::BIGINT,
    COALESCE(SUM(p.tokens_in),0)::BIGINT,
    COALESCE(SUM(p.tokens_out),0)::BIGINT,
    COALESCE(SUM(p.cost_usd),0)::NUMERIC
  FROM public.ai_prompt_log p
  WHERE p.created_at >= date_trunc('day', now())
    AND p.created_at <  date_trunc('day', now()) + interval '1 day'
    AND p.user_id = p_user_id
  GROUP BY p.group_category
  ORDER BY 5 DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_history(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  day DATE,
  group_category TEXT,
  daily_cost NUMERIC,
  daily_tokens BIGINT,
  call_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (p.created_at AT TIME ZONE 'UTC')::date,
    p.group_category,
    COALESCE(SUM(p.cost_usd),0)::NUMERIC,
    COALESCE(SUM(p.tokens_total),0)::BIGINT,
    COUNT(*)::BIGINT
  FROM public.ai_prompt_log p
  WHERE p.user_id = p_user_id
    AND p.created_at >= now() - (GREATEST(p_days,1) || ' days')::interval
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2 ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_top_functions(p_user_id UUID, p_since TIMESTAMPTZ, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  function_name TEXT,
  total_cost NUMERIC,
  calls BIGINT,
  total_tokens BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.function_name,
    COALESCE(SUM(p.cost_usd),0)::NUMERIC,
    COUNT(*)::BIGINT,
    COALESCE(SUM(p.tokens_total),0)::BIGINT
  FROM public.ai_prompt_log p
  WHERE p.user_id = p_user_id
    AND p.created_at >= COALESCE(p_since, now() - interval '30 days')
  GROUP BY p.function_name
  ORDER BY 2 DESC
  LIMIT GREATEST(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.get_prompt_size_distribution(p_user_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  size_range TEXT,
  size_order INTEGER,
  count BIGINT,
  avg_cost NUMERIC,
  avg_latency NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE
      WHEN total_input_chars < 1000 THEN '0-1K'
      WHEN total_input_chars < 5000 THEN '1K-5K'
      WHEN total_input_chars < 10000 THEN '5K-10K'
      WHEN total_input_chars < 25000 THEN '10K-25K'
      WHEN total_input_chars < 50000 THEN '25K-50K'
      WHEN total_input_chars < 100000 THEN '50K-100K'
      ELSE '100K+'
    END,
    CASE
      WHEN total_input_chars < 1000 THEN 1
      WHEN total_input_chars < 5000 THEN 2
      WHEN total_input_chars < 10000 THEN 3
      WHEN total_input_chars < 25000 THEN 4
      WHEN total_input_chars < 50000 THEN 5
      WHEN total_input_chars < 100000 THEN 6
      ELSE 7
    END,
    COUNT(*)::BIGINT,
    COALESCE(AVG(cost_usd),0)::NUMERIC,
    COALESCE(AVG(latency_ms),0)::NUMERIC
  FROM public.ai_prompt_log p
  WHERE p.user_id = p_user_id
    AND p.created_at >= now() - (GREATEST(p_days,1) || ' days')::interval
  GROUP BY 1, 2
  ORDER BY 2 ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_cron_vs_user(p_user_id UUID)
RETURNS TABLE (
  source TEXT,
  calls BIGINT,
  total_tokens BIGINT,
  total_cost NUMERIC,
  top_function TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT
      CASE WHEN p.is_cron THEN 'cron' ELSE 'user' END AS source,
      p.function_name,
      p.tokens_total,
      p.cost_usd
    FROM public.ai_prompt_log p
    WHERE p.created_at >= date_trunc('day', now())
      AND p.user_id = p_user_id
  ),
  totals AS (
    SELECT source,
      COUNT(*)::BIGINT AS calls,
      COALESCE(SUM(tokens_total),0)::BIGINT AS total_tokens,
      COALESCE(SUM(cost_usd),0)::NUMERIC AS total_cost
    FROM base GROUP BY source
  ),
  topfn AS (
    SELECT DISTINCT ON (source)
      source, function_name AS top_function
    FROM (
      SELECT source, function_name, SUM(cost_usd) AS c
      FROM base GROUP BY source, function_name
      ORDER BY source, c DESC
    ) s
  )
  SELECT t.source, t.calls, t.total_tokens, t.total_cost,
         COALESCE(tf.top_function, '-') AS top_function
  FROM totals t
  LEFT JOIN topfn tf ON tf.source = t.source
  ORDER BY t.total_cost DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_period_total(p_user_id UUID, p_period_start TIMESTAMPTZ)
RETURNS TABLE (
  total_cost NUMERIC,
  total_tokens_in BIGINT,
  total_tokens_out BIGINT,
  total_calls BIGINT,
  cost_today NUMERIC,
  calls_today BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(cost_usd),0)::NUMERIC,
    COALESCE(SUM(tokens_in),0)::BIGINT,
    COALESCE(SUM(tokens_out),0)::BIGINT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(CASE WHEN created_at >= date_trunc('day', now()) THEN cost_usd ELSE 0 END),0)::NUMERIC,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::BIGINT
  FROM public.ai_prompt_log
  WHERE user_id = p_user_id
    AND created_at >= COALESCE(p_period_start, date_trunc('month', now()));
$$;

GRANT EXECUTE ON FUNCTION public.get_today_by_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_functions(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prompt_size_distribution(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_vs_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_period_total(UUID, TIMESTAMPTZ) TO authenticated;

-- 5) Vista riconciliazione ai_prompt_log vs ai_token_usage
CREATE OR REPLACE VIEW public.ai_usage_reconciliation AS
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
