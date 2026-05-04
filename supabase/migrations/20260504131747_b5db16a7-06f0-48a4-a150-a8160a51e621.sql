CREATE TABLE IF NOT EXISTS public.funnemail_sender_intel (
  email_domain text PRIMARY KEY,
  is_known_partner boolean NOT NULL DEFAULT false,
  partner_id uuid NULL REFERENCES public.partners(id) ON DELETE SET NULL,
  company_type text NULL,
  country text NULL,
  website text NULL,
  role_guess text NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  scout_source text NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnemail_sender_intel_partner
  ON public.funnemail_sender_intel(partner_id);
CREATE INDEX IF NOT EXISTS idx_funnemail_sender_intel_expires
  ON public.funnemail_sender_intel(expires_at);

ALTER TABLE public.funnemail_sender_intel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fsi_select_authenticated" ON public.funnemail_sender_intel;
CREATE POLICY "fsi_select_authenticated"
  ON public.funnemail_sender_intel
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fsi_block_writes_for_users" ON public.funnemail_sender_intel;
CREATE POLICY "fsi_block_writes_for_users"
  ON public.funnemail_sender_intel
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_funnemail_sender_intel_updated_at ON public.funnemail_sender_intel;
    CREATE TRIGGER update_funnemail_sender_intel_updated_at
      BEFORE UPDATE ON public.funnemail_sender_intel
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.ai_scope_registry (scope, description, enforcement_mode, requires_grounding, allowed_tools)
VALUES (
  'funnemail_scout',
  'Scout livello 1 sul dominio mittente di email inbound: classifica tipo azienda (cliente, partner, forwarder, fornitore) per arricchire la decisione Funnemail.',
  'warn',
  false,
  ARRAY['sherlock_extract']
)
ON CONFLICT (scope) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();
