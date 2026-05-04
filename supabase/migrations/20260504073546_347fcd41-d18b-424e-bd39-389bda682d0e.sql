-- 1) Estendo profiles con i campi necessari al SSO FindAir e ai dati personali per email
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS findair_sub TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS email_signature_html TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_findair_sub_unique
  ON public.profiles (findair_sub)
  WHERE findair_sub IS NOT NULL;

-- 2) Tabella oauth_state per CSRF protection (solo edge function la usa via service role)
CREATE TABLE IF NOT EXISTS public.oauth_state (
  state TEXT PRIMARY KEY,
  redirect_to TEXT NOT NULL DEFAULT '/v2',
  frontend_callback TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at TIMESTAMPTZ
);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;

-- Nessuna policy SELECT/INSERT/UPDATE per il ruolo authenticated:
-- la tabella è accessibile SOLO via service_role dalla edge function findair-proxy.
-- (RLS attiva senza policy = nessun accesso per anon/authenticated.)

-- 3) Cleanup automatico degli state scaduti (via funzione, chiamabile da cron o dalla edge stessa)
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_state()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_state
  WHERE expires_at < now() - interval '1 hour';
END;
$$;