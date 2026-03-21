DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'download_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.download_jobs;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_campaign_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_campaign_queue;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
  END IF;
END $$;

ALTER TABLE public.email_campaign_queue 
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT NULL;

ALTER TABLE public.email_campaign_queue 
ADD COLUMN IF NOT EXISTS opened_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0;