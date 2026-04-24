-- Tabella per le run di "Armonizza tutto" (refactor profondo del sistema)
CREATE TABLE IF NOT EXISTS public.harmonize_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text,
  scope text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'collecting',
  real_inventory_summary jsonb DEFAULT '{}'::jsonb,
  desired_inventory_summary jsonb DEFAULT '{}'::jsonb,
  gap_classification jsonb DEFAULT '{}'::jsonb,
  proposals jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_files jsonb DEFAULT '[]'::jsonb,
  executed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

ALTER TABLE public.harmonize_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own harmonize runs"
  ON public.harmonize_runs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_harmonize_runs_user_active
  ON public.harmonize_runs (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_harmonize_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_harmonize_runs_updated_at ON public.harmonize_runs;
CREATE TRIGGER trg_harmonize_runs_updated_at
  BEFORE UPDATE ON public.harmonize_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_harmonize_runs_updated_at();