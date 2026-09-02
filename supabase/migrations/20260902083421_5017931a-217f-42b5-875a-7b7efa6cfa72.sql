CREATE TABLE public.usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'feature' CHECK (kind IN ('route','edge','feature','quarantine')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_events_name_kind ON public.usage_events (name, kind, created_at DESC);
GRANT INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert usage events" ON public.usage_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role reads usage events" ON public.usage_events FOR SELECT TO service_role USING (true);