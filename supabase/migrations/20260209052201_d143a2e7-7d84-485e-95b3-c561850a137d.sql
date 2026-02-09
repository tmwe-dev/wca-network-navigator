
-- Table to track background download jobs
CREATE TABLE public.download_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  network_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'error', 'cancelled')),
  wca_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  processed_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  delay_seconds INT NOT NULL DEFAULT 30,
  last_processed_wca_id INT,
  last_processed_company TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- No RLS needed - this is an internal tool, no auth
ALTER TABLE public.download_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth in this app)
CREATE POLICY "Allow all on download_jobs" ON public.download_jobs FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_download_jobs_updated_at
  BEFORE UPDATE ON public.download_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.download_jobs;
