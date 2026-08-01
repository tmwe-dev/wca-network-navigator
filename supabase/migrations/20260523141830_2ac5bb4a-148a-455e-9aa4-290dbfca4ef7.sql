CREATE TABLE IF NOT EXISTS public.system_loops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  edge_function text NOT NULL,
  category text NOT NULL CHECK (category IN ('cron','on-demand','chat','batch')),
  cron_schedule text,
  enabled boolean NOT NULL DEFAULT true,
  deprecated boolean NOT NULL DEFAULT false,
  deprecation_reason text,
  planned_removal_date date,
  activity_table text,
  activity_timestamp_column text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_loops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_loops_read_authenticated"
  ON public.system_loops FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "system_loops_admin_write"
  ON public.system_loops FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_system_loops_updated_at
  BEFORE UPDATE ON public.system_loops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.system_loops (name, edge_function, category, cron_schedule, enabled, deprecated, deprecation_reason, activity_table, activity_timestamp_column, notes) VALUES
  ('agent-prompt-refiner', 'agent-prompt-refiner', 'cron', '0 4 * * 1', true, false, NULL, 'cron_run_log', 'created_at', 'Weekly refiner. Alive (last run 2026-05-18).'),
  ('prompt-test-runner',   'prompt-test-runner',   'cron', '45 3 * * *', true, false, NULL, 'prompt_test_runs', 'created_at', '34 runs/30d. Alive.'),
  ('kb-promoter',          'kb-promoter',          'cron', '30 3 * * *', true, false, NULL, 'kb_entries',      'created_at', 'Daily KB promotion. Alive.'),
  ('memory-promoter',      'memory-promoter',      'cron', '0 3 * * *',  true, false, NULL, NULL,              NULL,         'Daily memory promotion. Alive.'),
  ('harmonize-proposal-chat','harmonize-proposal-chat','chat', NULL,    true, false, NULL, 'harmonize_runs',  'created_at', '20 runs/30d on-demand. Alive.'),
  ('prompt-copilot-chat',  'prompt-copilot-chat',  'chat', NULL,         true, false, NULL, NULL,              NULL,         'On-demand chat from PromptCopilotPanel. Low usage, monitor.'),
  ('refine-classification-rule','refine-classification-rule','on-demand', NULL, true, false, NULL, NULL,        NULL,         'On-demand from AISuggestionsTab. Low usage, monitor.'),
  ('ai-test-runner',       'ai-test-runner',       'on-demand', NULL,    true, false, NULL, 'ai_lab_test_runs','started_at', '4 runs/30d from AI Lab UI. Low usage, monitor.')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE public.system_loops IS
  'F6 — Registry of AI auto-improvement loops. SSOT for enable/deprecate flags. Read-only for non-admin. Seeded 2026-05-23 with real telemetry — none of the 8 loops were dead at seed time.';

CREATE OR REPLACE VIEW public.v_system_loops_status
WITH (security_invoker = true)
AS
SELECT
  id, name, edge_function, category, cron_schedule, enabled,
  deprecated, deprecation_reason, planned_removal_date,
  activity_table, activity_timestamp_column, notes, updated_at
FROM public.system_loops
ORDER BY category, name;

GRANT SELECT ON public.v_system_loops_status TO authenticated;