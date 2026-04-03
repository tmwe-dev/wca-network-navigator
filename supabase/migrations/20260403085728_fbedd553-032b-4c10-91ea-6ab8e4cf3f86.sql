-- Create email_sync_jobs table for server-side autonomous email downloading
CREATE TABLE public.email_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'error')),
  downloaded_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  total_remaining INTEGER NOT NULL DEFAULT 0,
  last_batch_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own sync jobs"
  ON public.email_sync_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own sync jobs
CREATE POLICY "Users can create their own sync jobs"
  ON public.email_sync_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sync jobs
CREATE POLICY "Users can update their own sync jobs"
  ON public.email_sync_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sync jobs
CREATE POLICY "Users can delete their own sync jobs"
  ON public.email_sync_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Index for the worker to quickly find running jobs
CREATE INDEX idx_email_sync_jobs_status ON public.email_sync_jobs (status) WHERE status = 'running';

-- Auto-update updated_at
CREATE TRIGGER update_email_sync_jobs_updated_at
  BEFORE UPDATE ON public.email_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_sync_jobs;