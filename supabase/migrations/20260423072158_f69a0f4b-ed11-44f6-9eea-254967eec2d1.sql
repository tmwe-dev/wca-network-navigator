-- Token usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  model text,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  cost_estimate numeric(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "token_usage_user" ON public.ai_token_usage;
CREATE POLICY "token_usage_user" ON public.ai_token_usage
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON public.ai_token_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_function ON public.ai_token_usage(function_name, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_user_key
  ON public.app_settings(user_id, key) WHERE user_id IS NOT NULL;

-- Default token settings for existing users
INSERT INTO public.app_settings (key, value, user_id)
SELECT v.key, v.value::jsonb, u.id
FROM auth.users u
CROSS JOIN (VALUES
  ('ai_daily_token_limit', '500000'),
  ('ai_monthly_token_limit', '10000000'),
  ('ai_max_tokens_generate_email', '1500'),
  ('ai_max_tokens_generate_outreach', '1200'),
  ('ai_max_tokens_improve_email', '1500'),
  ('ai_max_tokens_classify_email', '300'),
  ('ai_max_tokens_ai_assistant', '2048'),
  ('ai_max_tokens_daily_briefing', '1000'),
  ('ai_rate_limit_per_minute', '20'),
  ('ai_cooldown_between_calls_ms', '500')
) AS v(key, value)
ON CONFLICT (user_id, key) WHERE user_id IS NOT NULL DO NOTHING;