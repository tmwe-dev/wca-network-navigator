-- ── Tabella bulk_jobs ─────────────────────────────────────────────
CREATE TABLE public.bulk_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL,
  source_view TEXT,
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT bulk_jobs_status_chk CHECK (status IN ('pending','running','completed','completed_with_errors','failed','cancelled'))
);

CREATE INDEX bulk_jobs_created_by_idx ON public.bulk_jobs(created_by);
CREATE INDEX bulk_jobs_status_idx ON public.bulk_jobs(status);
CREATE INDEX bulk_jobs_scope_idx ON public.bulk_jobs(scope);
CREATE INDEX bulk_jobs_created_at_idx ON public.bulk_jobs(created_at DESC);

ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view bulk jobs"
ON public.bulk_jobs FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can create own bulk jobs"
ON public.bulk_jobs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and admins can update bulk jobs"
ON public.bulk_jobs FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_bulk_jobs_updated_at
BEFORE UPDATE ON public.bulk_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Tabella bulk_job_events ───────────────────────────────────────
CREATE TABLE public.bulk_job_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.bulk_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bulk_job_events_job_id_idx ON public.bulk_job_events(job_id, created_at DESC);

ALTER TABLE public.bulk_job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible to job owner and admins"
ON public.bulk_job_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bulk_jobs j
    WHERE j.id = bulk_job_events.job_id
      AND (j.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Job owners can append events"
ON public.bulk_job_events FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bulk_jobs j
    WHERE j.id = bulk_job_events.job_id
      AND (j.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- ── Realtime ──────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_job_events;