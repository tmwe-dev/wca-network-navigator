
-- Tabella per ricevere risultati e2e dal workflow GitHub Actions
CREATE TABLE IF NOT EXISTS public.e2e_run_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  commit_sha TEXT,
  branch TEXT,
  workflow TEXT NOT NULL DEFAULT 'e2e-nightly',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_tests INT NOT NULL DEFAULT 0,
  passed INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  flaky INT NOT NULL DEFAULT 0,
  duration_ms BIGINT,
  report_url TEXT,
  spec_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_e2e_run_results_finished_at ON public.e2e_run_results(finished_at DESC);

ALTER TABLE public.e2e_run_results ENABLE ROW LEVEL SECURITY;

-- Solo utenti autenticati con ruolo admin/operator possono leggere
CREATE POLICY "Authenticated users can read e2e results"
ON public.e2e_run_results FOR SELECT
TO authenticated
USING (true);

-- Solo service role può inserire (via edge function webhook con header secret)
CREATE POLICY "Service role can insert e2e results"
ON public.e2e_run_results FOR INSERT
TO service_role
WITH CHECK (true);
