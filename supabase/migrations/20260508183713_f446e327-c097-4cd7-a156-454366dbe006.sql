-- Sprint 5 (retry): Eval cases
CREATE TABLE IF NOT EXISTS public.funnemail_eval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  inbound_payload jsonb NOT NULL,
  expected_decision jsonb NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funnemail_eval_cases_enabled_idx ON public.funnemail_eval_cases (enabled);
CREATE INDEX IF NOT EXISTS funnemail_eval_cases_tags_idx ON public.funnemail_eval_cases USING GIN (tags);

ALTER TABLE public.funnemail_eval_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_cases_select_authenticated"
  ON public.funnemail_eval_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_cases_admin_modify"
  ON public.funnemail_eval_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER funnemail_eval_cases_updated_at
  BEFORE UPDATE ON public.funnemail_eval_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.funnemail_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.funnemail_eval_cases(id) ON DELETE CASCADE,
  prompt_version_id uuid,
  actual_decision jsonb,
  passed boolean NOT NULL DEFAULT false,
  diff jsonb,
  latency_ms integer,
  cost_usd numeric,
  error text,
  run_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funnemail_eval_runs_case_idx ON public.funnemail_eval_runs (case_id, run_at DESC);
CREATE INDEX IF NOT EXISTS funnemail_eval_runs_passed_idx ON public.funnemail_eval_runs (passed, run_at DESC);

ALTER TABLE public.funnemail_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_runs_select_authenticated"
  ON public.funnemail_eval_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_runs_admin_modify"
  ON public.funnemail_eval_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Brain view con cast text
CREATE OR REPLACE VIEW public.funnemail_brain_v
WITH (security_invoker = true) AS
SELECT
  cm.id AS message_id,
  cm.user_id,
  cm.channel,
  cm.from_address,
  cm.subject,
  cm.created_at AS received_at,
  cm.ai_classification_suggestion,
  j.stage AS job_stage,
  j.attempts AS job_attempts,
  j.last_error AS job_last_error,
  j.completed_at AS job_completed_at,
  d.suggested_action AS decision_action,
  d.confidence AS decision_confidence,
  d.reasoning AS decision_reasoning,
  d.created_at AS decision_at,
  s.status AS funnemail_status,
  s.sub_status AS funnemail_sub_status,
  (SELECT count(*) FROM public.funnemail_actions_log al WHERE al.message_id = cm.id::text) AS actions_count,
  (SELECT count(*) FROM public.funnemail_actions_log al WHERE al.message_id = cm.id::text AND al.status = 'ok') AS actions_ok_count,
  (SELECT max(al.created_at) FROM public.funnemail_actions_log al WHERE al.message_id = cm.id::text) AS last_action_at
FROM public.channel_messages cm
LEFT JOIN public.email_processing_jobs j ON j.message_id = cm.id
LEFT JOIN LATERAL (
  SELECT * FROM public.funnemail_decisions fd
  WHERE fd.message_id = cm.id::text
  ORDER BY fd.created_at DESC
  LIMIT 1
) d ON true
LEFT JOIN public.funnemail_message_status s ON s.message_id = cm.id::text;

GRANT SELECT ON public.funnemail_brain_v TO authenticated;