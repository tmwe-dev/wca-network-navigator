-- ai_token_usage
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

CREATE POLICY "token_usage_select_own" ON public.ai_token_usage
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "token_usage_insert_own" ON public.ai_token_usage
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "token_usage_update_own" ON public.ai_token_usage
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "token_usage_delete_own" ON public.ai_token_usage
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON public.ai_token_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_function ON public.ai_token_usage(function_name, created_at);

-- Seed default token settings (app_settings.user_id già esiste nel DB)
INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_daily_token_limit', '500000', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_monthly_token_limit', '10000000', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_max_tokens_generate_email', '1500', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_max_tokens_generate_outreach', '1200', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_max_tokens_improve_email', '1500', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_max_tokens_classify_email', '300', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_max_tokens_ai_assistant', '2048', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_rate_limit_per_minute', '20', id FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (key, value, user_id)
SELECT 'ai_cooldown_between_calls_ms', '500', id FROM auth.users
ON CONFLICT DO NOTHING;

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL CHECK (type IN ('email_received', 'deal_stage_change', 'ai_completed', 'system_error', 'outreach_reply', 'reminder')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read boolean DEFAULT false,
  dismissed boolean DEFAULT false,
  action_url text,
  entity_type text CHECK (entity_type IN ('partner', 'contact', 'deal', 'email')),
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id);

-- push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_select_own" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_sub_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_sub_update_own" ON public.push_subscriptions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "push_sub_delete_own" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Abilita Realtime su ai_token_usage
ALTER TABLE public.ai_token_usage REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_token_usage'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_token_usage';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;