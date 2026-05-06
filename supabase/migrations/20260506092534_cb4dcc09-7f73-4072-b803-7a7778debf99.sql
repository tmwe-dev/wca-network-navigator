
CREATE TABLE IF NOT EXISTS public.finder_api_schema_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op TEXT NOT NULL,
  field TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'altro',
  description TEXT,
  example TEXT,
  sample_value TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finder_api_schema_map_op_field_unique UNIQUE (op, field)
);

CREATE INDEX IF NOT EXISTS idx_finder_api_schema_map_op ON public.finder_api_schema_map(op);
CREATE INDEX IF NOT EXISTS idx_finder_api_schema_map_role ON public.finder_api_schema_map(role);

ALTER TABLE public.finder_api_schema_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schema_map_read_authenticated"
  ON public.finder_api_schema_map FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "schema_map_insert_authenticated"
  ON public.finder_api_schema_map FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "schema_map_update_authenticated"
  ON public.finder_api_schema_map FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "schema_map_delete_authenticated"
  ON public.finder_api_schema_map FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER finder_api_schema_map_set_updated_at
  BEFORE UPDATE ON public.finder_api_schema_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
