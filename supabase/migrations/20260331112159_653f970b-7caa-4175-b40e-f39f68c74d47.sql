
CREATE TABLE public.linkedin_flow_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_count INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  delay_seconds INT NOT NULL DEFAULT 15,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.linkedin_flow_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.linkedin_flow_jobs(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  contact_name TEXT,
  company_name TEXT,
  linkedin_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'cockpit',
  status TEXT NOT NULL DEFAULT 'pending',
  scraped_data JSONB,
  enrichment_result JSONB,
  error_message TEXT,
  position INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_flow_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_flow_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flow jobs" ON public.linkedin_flow_jobs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own flow items" ON public.linkedin_flow_items
  FOR ALL TO authenticated USING (
    job_id IN (SELECT id FROM public.linkedin_flow_jobs WHERE user_id = auth.uid())
  ) WITH CHECK (
    job_id IN (SELECT id FROM public.linkedin_flow_jobs WHERE user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.linkedin_flow_jobs;
