
-- Email campaign queue table
CREATE TABLE public.email_campaign_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id uuid REFERENCES public.email_drafts(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  html_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  position integer NOT NULL DEFAULT 0
);

-- Add queue control columns to email_drafts
ALTER TABLE public.email_drafts 
  ADD COLUMN IF NOT EXISTS queue_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS queue_delay_seconds integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS queue_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS queue_completed_at timestamp with time zone;

-- RLS on email_campaign_queue
ALTER TABLE public.email_campaign_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_email_campaign_queue_all" ON public.email_campaign_queue
  AS RESTRICTIVE FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_campaign_queue;

-- Index for queue processing
CREATE INDEX idx_email_campaign_queue_status ON public.email_campaign_queue(draft_id, status);
CREATE INDEX idx_email_campaign_queue_position ON public.email_campaign_queue(draft_id, position);
