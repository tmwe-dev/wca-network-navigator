
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text,
  idempotency_key text,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  partner_id uuid,
  activity_id uuid,
  draft_id uuid,
  campaign_queue_id uuid,
  channel text NOT NULL DEFAULT 'email',
  send_method text NOT NULL,
  status text NOT NULL,
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_send_log_send_method_chk
    CHECK (send_method IN ('direct','queue','campaign','agent')),
  CONSTRAINT email_send_log_status_chk
    CHECK (status IN ('sent','failed','bounced','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_esl_user_sent_at
  ON public.email_send_log (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_esl_status_partial
  ON public.email_send_log (status)
  WHERE status <> 'sent';

CREATE INDEX IF NOT EXISTS idx_esl_message_id
  ON public.email_send_log (message_id)
  WHERE message_id IS NOT NULL;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esl_select_own"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "esl_insert_own"
  ON public.email_send_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
