-- Content Intelligence Layer: AI legge il contenuto della mail e propone azioni
-- senza enum chiusi sui campi semantici (label, intent_summary).

CREATE TABLE IF NOT EXISTS public.email_content_intelligence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL,
  user_id         uuid,
  partner_id      uuid,
  from_address    text,
  -- Campi AI-driven (no enum chiusi)
  content_label   text NOT NULL DEFAULT '',
  intent_summary  text NOT NULL DEFAULT '',
  business_value  text,           -- high|medium|low|none (libero)
  urgency         text,           -- critical|high|normal|low (libero)
  target_role     text,           -- commercial|operational|administrative|none (libero)
  continuity      jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning       text,
  confidence      numeric(4,3) NOT NULL DEFAULT 0,
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model           text,
  context_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_action_ids uuid[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_eci_message ON public.email_content_intelligence(message_id);
CREATE INDEX IF NOT EXISTS idx_eci_user_created ON public.email_content_intelligence(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eci_partner ON public.email_content_intelligence(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eci_urgency ON public.email_content_intelligence(user_id, urgency) WHERE urgency IN ('critical','high');

ALTER TABLE public.email_content_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eci_select_own"
  ON public.email_content_intelligence FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "eci_insert_service"
  ON public.email_content_intelligence FOR INSERT
  WITH CHECK (true);

CREATE POLICY "eci_update_own"
  ON public.email_content_intelligence FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_eci_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_eci_updated_at ON public.email_content_intelligence;
CREATE TRIGGER trg_eci_updated_at BEFORE UPDATE ON public.email_content_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.tg_eci_updated_at();

COMMENT ON TABLE public.email_content_intelligence IS
  'Strato 2 del classificatore inbound: lettura del CONTENUTO della mail con contesto pieno (mittente, history, holding, KB). Append-friendly, una riga per message_id.';
