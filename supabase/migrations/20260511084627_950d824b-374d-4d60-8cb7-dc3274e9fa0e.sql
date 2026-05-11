
CREATE TABLE IF NOT EXISTS public.system_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'false'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_flags read authenticated"
ON public.system_flags FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "system_flags admin write"
ON public.system_flags FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.system_flags (key, value, description) VALUES
  ('cron_paused', 'false'::jsonb, 'Quando true blocca tutti i cron job automatici (transmissions kill-switch).')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_cron_paused()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value)::text::boolean FROM public.system_flags WHERE key = 'cron_paused'), false)
$$;
