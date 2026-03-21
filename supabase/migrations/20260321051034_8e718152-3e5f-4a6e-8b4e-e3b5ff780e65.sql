
-- download_job_items: per-profile tracking
CREATE TABLE public.download_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.download_jobs(id) ON DELETE CASCADE,
  wca_id integer NOT NULL,
  position integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  contacts_found integer NOT NULL DEFAULT 0,
  contacts_missing integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dji_job_status ON public.download_job_items(job_id, status);
ALTER TABLE public.download_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_download_job_items_all" ON public.download_job_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- download_job_events: append-only audit log
CREATE TABLE public.download_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.download_jobs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.download_job_items(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dje_job ON public.download_job_events(job_id, created_at);
ALTER TABLE public.download_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_download_job_events_all" ON public.download_job_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
