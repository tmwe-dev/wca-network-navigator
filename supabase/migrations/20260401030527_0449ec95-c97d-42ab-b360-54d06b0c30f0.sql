
CREATE TABLE public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'partner',
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  UNIQUE (source_id, user_id)
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own client_assignments"
  ON public.client_assignments FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
