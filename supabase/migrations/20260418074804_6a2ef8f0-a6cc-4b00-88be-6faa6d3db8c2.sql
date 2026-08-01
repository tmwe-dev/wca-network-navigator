-- Create page_events table for client-side telemetry
CREATE TABLE IF NOT EXISTS public.page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_name text NOT NULL,
  page text NOT NULL,
  entity_type text,
  entity_id text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_events_created_at ON public.page_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_user_id ON public.page_events (user_id);
CREATE INDEX IF NOT EXISTS idx_page_events_event_name ON public.page_events (event_name);
CREATE INDEX IF NOT EXISTS idx_page_events_page ON public.page_events (page);

ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated (and even anonymous fire-and-forget) can insert their own events
CREATE POLICY "Anyone can insert telemetry events"
  ON public.page_events
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read telemetry
CREATE POLICY "Admins can read all page_events"
  ON public.page_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read their own events
CREATE POLICY "Users can read own page_events"
  ON public.page_events
  FOR SELECT
  USING (auth.uid() = user_id);