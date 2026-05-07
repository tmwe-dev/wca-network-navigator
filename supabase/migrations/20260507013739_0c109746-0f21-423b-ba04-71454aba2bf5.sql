
-- Templates table
CREATE TABLE IF NOT EXISTS public.funnemail_autoresponder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'it',
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  trigger_rule JSONB NOT NULL DEFAULT '{"requires_ack": true}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funnemail_autoresponder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autoresp_templates_read_authenticated"
  ON public.funnemail_autoresponder_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "autoresp_templates_admin_write"
  ON public.funnemail_autoresponder_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Audit log
CREATE TABLE IF NOT EXISTS public.funnemail_autoresponder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id UUID,
  template_id UUID REFERENCES public.funnemail_autoresponder_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  recipient_email TEXT NOT NULL,
  rendered_subject TEXT,
  rendered_body TEXT,
  variables JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  send_email_response JSONB,
  triggered_by TEXT NOT NULL DEFAULT 'classify-inbound-message',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funnemail_autoresponder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autoresp_log_read_authenticated"
  ON public.funnemail_autoresponder_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "autoresp_log_service_insert"
  ON public.funnemail_autoresponder_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX idx_autoresp_log_message ON public.funnemail_autoresponder_log(source_message_id);
CREATE INDEX idx_autoresp_log_recipient ON public.funnemail_autoresponder_log(recipient_email, created_at DESC);

-- Anti-duplicate guard: never autorespond twice to the same source message
CREATE UNIQUE INDEX idx_autoresp_log_unique_per_message
  ON public.funnemail_autoresponder_log(source_message_id)
  WHERE source_message_id IS NOT NULL AND status = 'sent';

-- Trigger updated_at
CREATE TRIGGER trg_autoresp_templates_updated
  BEFORE UPDATE ON public.funnemail_autoresponder_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates (Italian + English) — pre-approved by system
INSERT INTO public.funnemail_autoresponder_templates
  (name, language, subject_template, body_template, notes)
VALUES
  ('default_ack_it', 'it',
   'Re: {oggetto} — Ricevuto',
   'Ciao {nome},

Abbiamo ricevuto la tua email e l''abbiamo presa in carico.
Il team commerciale ti risponderà entro 24 ore lavorative.

Riferimento: {ticket_id}

A presto,
Funnemail',
   'Template di default italiano. Solo variabili sicure: {nome}, {oggetto}, {ticket_id}. Pre-approvato — bypassa journalistReview.'),
  ('default_ack_en', 'en',
   'Re: {oggetto} — Received',
   'Hi {nome},

We have received your email and it is now being handled by our team.
You will hear back from us within 24 business hours.

Reference: {ticket_id}

Best regards,
Funnemail',
   'Default English template. Safe variables only: {nome}, {oggetto}, {ticket_id}. Pre-approved — bypasses journalistReview.')
ON CONFLICT (name) DO NOTHING;
