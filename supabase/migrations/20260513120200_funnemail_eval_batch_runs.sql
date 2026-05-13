-- Sprint D: Batch-level eval runs tracking for accuracy over time.
-- Each batch run aggregates individual eval_runs into accuracy metrics.
CREATE TABLE IF NOT EXISTS public.funnemail_eval_batch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  dataset_size int NOT NULL DEFAULT 0,
  passed_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  accuracy numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN dataset_size > 0 THEN ROUND((passed_count::numeric / dataset_size) * 100, 2) ELSE 0 END
  ) STORED,
  prompt_version_id uuid,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnemail_eval_batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read eval batch runs"
  ON public.funnemail_eval_batch_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service insert eval batch runs"
  ON public.funnemail_eval_batch_runs FOR INSERT
  TO service_role
  WITH CHECK (true);
