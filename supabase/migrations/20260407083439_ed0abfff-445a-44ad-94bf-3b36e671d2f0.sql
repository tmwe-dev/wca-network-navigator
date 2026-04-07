
CREATE TABLE public.outreach_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  target_filters JSONB NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL DEFAULT 'email',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  processed_contacts INTEGER NOT NULL DEFAULT 0,
  agent_assignments JSONB DEFAULT '[]',
  schedule_config JSONB DEFAULT '{}',
  ai_summary TEXT,
  work_plan_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.outreach_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own missions"
  ON public.outreach_missions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own missions"
  ON public.outreach_missions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
  ON public.outreach_missions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own missions"
  ON public.outreach_missions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_outreach_missions_user_status ON public.outreach_missions(user_id, status);
