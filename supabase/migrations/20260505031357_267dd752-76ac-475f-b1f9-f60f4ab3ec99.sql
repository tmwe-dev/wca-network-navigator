
-- Alert recipients rubrica
CREATE TABLE IF NOT EXISTS public.alert_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  whatsapp_e164 TEXT NOT NULL,
  email TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  min_urgency_score INTEGER NOT NULL DEFAULT 70,
  is_active BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_user ON public.alert_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_categories ON public.alert_recipients USING GIN (categories);

ALTER TABLE public.alert_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_recipients_select_own" ON public.alert_recipients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "alert_recipients_insert_own" ON public.alert_recipients FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "alert_recipients_update_own" ON public.alert_recipients FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "alert_recipients_delete_own" ON public.alert_recipients FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_alert_recipients_updated BEFORE UPDATE ON public.alert_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alert dispatch log (idempotente)
CREATE TABLE IF NOT EXISTS public.alert_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recipient_id UUID NOT NULL REFERENCES public.alert_recipients(id) ON DELETE CASCADE,
  message_id UUID,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  business_category TEXT,
  urgency_score INTEGER,
  alert_categories TEXT[] DEFAULT '{}'::text[],
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  dedup_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_dispatch_recipient_message
  ON public.alert_dispatch_log(recipient_id, message_id)
  WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alert_dispatch_user_created ON public.alert_dispatch_log(user_id, created_at DESC);

ALTER TABLE public.alert_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_dispatch_log_select_own" ON public.alert_dispatch_log FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Solo service role inserisce (edge function); nessuna policy INSERT pubblica.
