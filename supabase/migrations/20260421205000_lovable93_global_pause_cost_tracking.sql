-- LOVABLE-93: Global pause control + cost tracking

-- Update app_settings to support per-user settings
-- Add user_id column to app_settings (if not already present)
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the old UNIQUE constraint on key-only and recreate with user_id
ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS app_settings_key_unique;

-- Add composite unique constraint (key, user_id)
ALTER TABLE public.app_settings
ADD CONSTRAINT app_settings_key_user_id_unique UNIQUE (key, user_id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON public.app_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key_user_id ON public.app_settings(key, user_id);

-- Create user_automation_settings table for additional pausable automations tracking
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

CREATE POLICY "Users can view own automation settings" ON public.user_automation_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own automation settings" ON public.user_automation_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own automation settings" ON public.user_automation_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_automation_settings_updated_at
  BEFORE UPDATE ON public.user_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Extend credit_transactions to store token counts
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS provider TEXT;

-- Create index for faster transaction lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_operation ON public.credit_transactions(operation);
