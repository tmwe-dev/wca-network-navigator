-- 1. Add response tracking columns to activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS message_id_external text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS thread_id text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS response_received boolean DEFAULT false;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS response_received_at timestamptz;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS response_channel_message_id uuid REFERENCES public.channel_messages(id);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS response_time_hours numeric;

CREATE INDEX IF NOT EXISTS idx_activities_message_id ON public.activities(message_id_external) WHERE message_id_external IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_thread_id ON public.activities(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_response ON public.activities(response_received, user_id) WHERE response_received = false;

-- 2. Create response_patterns table
CREATE TABLE IF NOT EXISTS public.response_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country_code text,
  channel text DEFAULT 'email',
  email_type text,
  company_size text,
  sector text,
  hook_strategy text,
  cta_type text,
  tone text,
  formality_level text,
  language text,
  total_sent integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  response_rate numeric GENERATED ALWAYS AS (CASE WHEN total_sent > 0 THEN (total_responses::numeric / total_sent::numeric) * 100 ELSE 0 END) STORED,
  avg_response_time_hours numeric,
  last_success_at timestamptz,
  pattern_confidence numeric DEFAULT 0.3,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.response_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns" ON public.response_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own patterns" ON public.response_patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access patterns" ON public.response_patterns FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_response_patterns_user ON public.response_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_response_patterns_country ON public.response_patterns(user_id, country_code, channel);

-- 3. Create link_response_to_activity RPC
CREATE OR REPLACE FUNCTION public.link_response_to_activity(
  p_channel_message_id uuid,
  p_activity_id uuid,
  p_response_time_hours numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.activities
  SET response_received = true,
      response_received_at = now(),
      response_channel_message_id = p_channel_message_id,
      response_time_hours = p_response_time_hours
  WHERE id = p_activity_id
    AND response_received = false;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_response_to_activity TO authenticated, service_role;