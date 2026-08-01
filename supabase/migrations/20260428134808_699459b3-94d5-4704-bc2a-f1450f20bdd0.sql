-- P3.1: Email delivery events table
CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'delivered','bounce_hard','bounce_soft','complaint','opened','clicked','deferred','rejected'
  )),
  recipient_email text NOT NULL,
  message_id text,
  campaign_queue_id uuid REFERENCES public.email_campaign_queue(id) ON DELETE SET NULL,
  smtp_code text,
  diagnostic_code text,
  reason text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'webhook',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_message_id
  ON public.email_delivery_events(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_recipient
  ON public.email_delivery_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_type_time
  ON public.email_delivery_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_queue
  ON public.email_delivery_events(campaign_queue_id) WHERE campaign_queue_id IS NOT NULL;

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;

-- Solo admin in lettura; insert/update/delete solo via service role (no policy = denied for normal users)
CREATE POLICY "email_delivery_events_admin_select"
  ON public.email_delivery_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger: aggiorna stato email_campaign_queue su bounce/complaint
CREATE OR REPLACE FUNCTION public.apply_email_delivery_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id uuid;
  v_new_status text;
BEGIN
  -- Risolvi campaign_queue_id (preferisci diretto, altrimenti via message_id)
  v_queue_id := NEW.campaign_queue_id;
  IF v_queue_id IS NULL AND NEW.message_id IS NOT NULL THEN
    SELECT id INTO v_queue_id
    FROM public.email_campaign_queue
    WHERE message_id = NEW.message_id
    LIMIT 1;
  END IF;

  IF v_queue_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map event → queue status
  v_new_status := CASE NEW.event_type
    WHEN 'bounce_hard' THEN 'bounced'
    WHEN 'bounce_soft' THEN 'bounced'
    WHEN 'complaint'   THEN 'complained'
    WHEN 'rejected'    THEN 'failed'
    ELSE NULL
  END;

  IF v_new_status IS NOT NULL THEN
    UPDATE public.email_campaign_queue
    SET status = v_new_status,
        error_message = COALESCE(NEW.reason, NEW.diagnostic_code, error_message),
        failed_at = COALESCE(failed_at, now())
    WHERE id = v_queue_id
      AND status NOT IN ('cancelled');
  END IF;

  -- Track open
  IF NEW.event_type = 'opened' THEN
    UPDATE public.email_campaign_queue
    SET opened_at = COALESCE(opened_at, NEW.occurred_at),
        open_count = COALESCE(open_count, 0) + 1
    WHERE id = v_queue_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_email_delivery_event ON public.email_delivery_events;
CREATE TRIGGER trg_apply_email_delivery_event
  AFTER INSERT ON public.email_delivery_events
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_email_delivery_event();