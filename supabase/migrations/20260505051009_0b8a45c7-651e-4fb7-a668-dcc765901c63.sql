-- Coda di arricchimento automatico per mail in arrivo da mittenti SCONOSCIUTI.
-- check-inbox enqueue, edge function process-inbound-enrichment processa in background.

CREATE TABLE IF NOT EXISTS public.inbound_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid NOT NULL,
  from_address text NOT NULL,
  domain text,
  status text NOT NULL DEFAULT 'pending', -- pending|processing|done|error|skipped
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT inbound_enrichment_queue_message_id_unique UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_enrichment_status_created
  ON public.inbound_enrichment_queue(status, created_at)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_inbound_enrichment_user
  ON public.inbound_enrichment_queue(user_id, status);

ALTER TABLE public.inbound_enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own enrichment jobs"
  ON public.inbound_enrichment_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages enrichment jobs"
  ON public.inbound_enrichment_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Suggerimento AI di classificazione visibile sulle card della inbox.
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS ai_classification_suggestion jsonb;
