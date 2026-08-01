
CREATE TABLE IF NOT EXISTS public.finder_api_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger_query TEXT,
  trigger_op TEXT,
  trigger_error TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','archived')),
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_finder_api_kb_status ON public.finder_api_kb(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_finder_api_kb_tags ON public.finder_api_kb USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_finder_api_kb_created ON public.finder_api_kb(created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.finder_api_kb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finder_api_kb_select_all_auth"
  ON public.finder_api_kb FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "finder_api_kb_insert_auth"
  ON public.finder_api_kb FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "finder_api_kb_update_owner_or_admin"
  ON public.finder_api_kb FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER trg_finder_api_kb_updated_at
  BEFORE UPDATE ON public.finder_api_kb
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.finder_api_kb;

INSERT INTO public.ai_scope_registry (scope, description)
VALUES ('finder_api', 'Finder API — query conversazionali su TMWE/Findair via proxy whitelistato; KB self-improving in finder_api_kb.')
ON CONFLICT (scope) DO NOTHING;
