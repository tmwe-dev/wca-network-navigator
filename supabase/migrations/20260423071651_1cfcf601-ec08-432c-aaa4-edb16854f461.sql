ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS app_settings_key_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_key_user_id_unique'
  ) THEN
    ALTER TABLE public.app_settings
    ADD CONSTRAINT app_settings_key_user_id_unique UNIQUE (key, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON public.app_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key_user_id ON public.app_settings(key, user_id);

CREATE TABLE IF NOT EXISTS public.user_automation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, automation_type)
);

ALTER TABLE public.user_automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own automation settings" ON public.user_automation_settings;
CREATE POLICY "Users can view own automation settings" ON public.user_automation_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own automation settings" ON public.user_automation_settings;
CREATE POLICY "Users can update own automation settings" ON public.user_automation_settings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own automation settings" ON public.user_automation_settings;
CREATE POLICY "Users can insert own automation settings" ON public.user_automation_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_automation_settings_updated_at ON public.user_automation_settings;
CREATE TRIGGER update_user_automation_settings_updated_at
  BEFORE UPDATE ON public.user_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_operation ON public.credit_transactions(operation);