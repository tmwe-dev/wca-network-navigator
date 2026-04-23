CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'meeting',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.imported_contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  location text,
  color text DEFAULT '#3B82F6',
  recurrence text,
  reminder_minutes integer DEFAULT 15,
  status text DEFAULT 'scheduled',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_user" ON public.calendar_events;
CREATE POLICY "calendar_user" ON public.calendar_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON public.calendar_events(user_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_partner ON public.calendar_events(partner_id);
CREATE INDEX IF NOT EXISTS idx_calendar_deal ON public.calendar_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_calendar_contact ON public.calendar_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_status ON public.calendar_events(status);

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();