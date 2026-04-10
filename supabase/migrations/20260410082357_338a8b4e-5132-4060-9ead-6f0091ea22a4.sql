
-- Create mission_actions table for granular action tracking
CREATE TABLE public.mission_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'outreach',
  action_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  idempotency_key TEXT,
  danger_level TEXT NOT NULL DEFAULT 'safe',
  position INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  recovery_log JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mission_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mission_actions"
  ON public.mission_actions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by mission
CREATE INDEX idx_mission_actions_mission_id ON public.mission_actions(mission_id);
CREATE INDEX idx_mission_actions_status ON public.mission_actions(status);

-- Add plan columns to outreach_missions (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outreach_missions') THEN
    ALTER TABLE public.outreach_missions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
    ALTER TABLE public.outreach_missions ADD COLUMN IF NOT EXISTS plan_json JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.outreach_missions ADD COLUMN IF NOT EXISTS danger_level TEXT DEFAULT 'safe';
    ALTER TABLE public.outreach_missions ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'draft';
  END IF;
END $$;
