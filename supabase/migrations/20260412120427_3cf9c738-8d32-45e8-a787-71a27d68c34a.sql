
-- Test run batches
CREATE TABLE public.ai_lab_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  warn_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.ai_lab_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test runs"
  ON public.ai_lab_test_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test runs"
  ON public.ai_lab_test_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own test runs"
  ON public.ai_lab_test_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Individual test results
CREATE TABLE public.ai_lab_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.ai_lab_test_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scenario_id INTEGER NOT NULL,
  scenario_name TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'fail',
  score INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  issues JSONB DEFAULT '[]'::jsonb,
  output_subject TEXT,
  output_body TEXT,
  debug_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_lab_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test results"
  ON public.ai_lab_test_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test results"
  ON public.ai_lab_test_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own test results"
  ON public.ai_lab_test_results FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_ai_lab_test_results_run_id ON public.ai_lab_test_results(run_id);
CREATE INDEX idx_ai_lab_test_runs_user_id ON public.ai_lab_test_runs(user_id, started_at DESC);
