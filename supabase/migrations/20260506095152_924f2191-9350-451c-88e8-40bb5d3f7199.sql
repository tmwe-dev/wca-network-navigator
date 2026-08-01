
DO $$ BEGIN
  CREATE TYPE public.tmwe_api_risk_level AS ENUM ('read','write','destructive','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tmwe_api_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op text NOT NULL UNIQUE,
  method text NOT NULL,
  path text NOT NULL,
  description text,
  scopes text[] NOT NULL DEFAULT '{}',
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  api_group text,
  risk_level public.tmwe_api_risk_level NOT NULL DEFAULT 'read',
  identity text NOT NULL DEFAULT 'user',
  enabled boolean NOT NULL DEFAULT false,
  requires_confirmation boolean NOT NULL DEFAULT false,
  is_alias boolean NOT NULL DEFAULT false,
  alias_of text,
  source text NOT NULL DEFAULT 'sync',
  verified_at timestamptz,
  last_called_at timestamptz,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tmwe_api_catalog_group ON public.tmwe_api_catalog(api_group);
CREATE INDEX IF NOT EXISTS idx_tmwe_api_catalog_risk ON public.tmwe_api_catalog(risk_level);
CREATE INDEX IF NOT EXISTS idx_tmwe_api_catalog_enabled ON public.tmwe_api_catalog(enabled);
CREATE INDEX IF NOT EXISTS idx_tmwe_api_catalog_method ON public.tmwe_api_catalog(method);

ALTER TABLE public.tmwe_api_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tmwe_catalog_read_authenticated" ON public.tmwe_api_catalog;
CREATE POLICY "tmwe_catalog_read_authenticated"
  ON public.tmwe_api_catalog FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tmwe_catalog_write_admin" ON public.tmwe_api_catalog;
CREATE POLICY "tmwe_catalog_write_admin"
  ON public.tmwe_api_catalog FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_tmwe_api_catalog_updated ON public.tmwe_api_catalog;
CREATE TRIGGER trg_tmwe_api_catalog_updated
  BEFORE UPDATE ON public.tmwe_api_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
