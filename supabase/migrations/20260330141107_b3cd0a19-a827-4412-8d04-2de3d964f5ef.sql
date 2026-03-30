
CREATE TABLE public.cockpit_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  partner_id UUID,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cockpit_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cockpit_queue"
  ON public.cockpit_queue
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cockpit_queue_user_status ON public.cockpit_queue (user_id, status);
CREATE UNIQUE INDEX idx_cockpit_queue_unique_source ON public.cockpit_queue (user_id, source_type, source_id);
