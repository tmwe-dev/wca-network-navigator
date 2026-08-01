
CREATE TABLE IF NOT EXISTS public.alert_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  webhook_url text,
  email_alert text,
  enabled boolean DEFAULT true,
  alert_on_degraded boolean DEFAULT true,
  alert_on_error_rate integer DEFAULT 10,
  cooldown_minutes integer DEFAULT 15,
  last_alert_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own alerts"
  ON public.alert_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
