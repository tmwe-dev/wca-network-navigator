CREATE TABLE IF NOT EXISTS prompt_lab_global_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text DEFAULT '',
  status text NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'improving', 'review', 'saving', 'done', 'failed', 'cancelled')),
  progress_current integer NOT NULL DEFAULT 0,
  progress_total integer NOT NULL DEFAULT 0,
  proposals jsonb NOT NULL DEFAULT '[]'::jsonb,
  system_map text DEFAULT '',
  doctrine_full text DEFAULT '',
  system_mission text DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

ALTER TABLE prompt_lab_global_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own global runs"
  ON prompt_lab_global_runs FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_global_runs_user_active
  ON prompt_lab_global_runs (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_global_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_runs_updated_at ON prompt_lab_global_runs;
CREATE TRIGGER trg_global_runs_updated_at
  BEFORE UPDATE ON prompt_lab_global_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_global_runs_updated_at();