
-- ================================================================
-- SPRINT 1 FUNNEMAIL: email_processing_jobs ledger
-- ================================================================

CREATE TYPE public.email_processing_stage AS ENUM (
  'received',
  'scouted',
  'classified',
  'routed',
  'policy_applied',
  'completed',
  'failed',
  'dlq'
);

CREATE TABLE public.email_processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL UNIQUE,
  user_id UUID,
  stage public.email_processing_stage NOT NULL DEFAULT 'received',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_processing_jobs_stage_user
  ON public.email_processing_jobs(stage, user_id);
CREATE INDEX idx_email_processing_jobs_stage_started
  ON public.email_processing_jobs(stage, started_at);

ALTER TABLE public.email_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processing jobs"
  ON public.email_processing_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role bypass è automatico; nessuna policy INSERT/UPDATE per utenti finali.

CREATE TRIGGER trg_email_processing_jobs_updated
  BEFORE UPDATE ON public.email_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- Helper RPC: registra/aggiorna stage in modo idempotente.
-- Chiamabile solo da service_role (security invoker, RLS attiva).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_email_processing_job_stage(
  p_message_id UUID,
  p_user_id UUID,
  p_stage public.email_processing_stage,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_is_terminal BOOLEAN;
BEGIN
  v_is_terminal := p_stage IN ('completed', 'failed', 'dlq');

  INSERT INTO public.email_processing_jobs (
    message_id, user_id, stage, payload, last_error, attempts,
    completed_at
  )
  VALUES (
    p_message_id, p_user_id, p_stage,
    COALESCE(p_payload, '{}'::jsonb),
    p_error,
    1,
    CASE WHEN v_is_terminal THEN now() ELSE NULL END
  )
  ON CONFLICT (message_id) DO UPDATE SET
    stage = EXCLUDED.stage,
    payload = public.email_processing_jobs.payload || COALESCE(EXCLUDED.payload, '{}'::jsonb),
    last_error = COALESCE(EXCLUDED.last_error, public.email_processing_jobs.last_error),
    attempts = public.email_processing_jobs.attempts + 1,
    completed_at = CASE WHEN v_is_terminal THEN now() ELSE public.email_processing_jobs.completed_at END,
    user_id = COALESCE(public.email_processing_jobs.user_id, EXCLUDED.user_id),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_processing_job_stage(UUID, UUID, public.email_processing_stage, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_email_processing_job_stage(UUID, UUID, public.email_processing_stage, JSONB, TEXT) TO service_role;

-- ================================================================
-- SPRINT 2 ANTICIPATO: Status materialization triggers
-- ================================================================

-- Trigger: AFTER INSERT su funnemail_decisions → upsert funnemail_message_status
CREATE OR REPLACE FUNCTION public.funnemail_decisions_to_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.funnemail_message_status (
    message_id,
    user_id,
    status,
    sub_status,
    status_reason,
    status_changed_by,
    status_changed_at
  )
  VALUES (
    NEW.message_id,
    NEW.user_id,
    'classified',
    NEW.suggested_action,
    'auto: classify decision (conf=' || COALESCE(NEW.confidence::TEXT, 'n/a') || ')',
    'system:funnemail-classify',
    now()
  )
  ON CONFLICT (message_id) DO UPDATE SET
    status = 'classified',
    sub_status = EXCLUDED.sub_status,
    status_reason = EXCLUDED.status_reason,
    status_changed_by = EXCLUDED.status_changed_by,
    status_changed_at = now()
  WHERE public.funnemail_message_status.status IN ('pending', 'received', 'classified');
  -- Non sovrascrive stati avanzati (es. claimed, replied, archived)

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funnemail_decisions_to_status ON public.funnemail_decisions;
CREATE TRIGGER trg_funnemail_decisions_to_status
  AFTER INSERT ON public.funnemail_decisions
  FOR EACH ROW EXECUTE FUNCTION public.funnemail_decisions_to_status();

-- Trigger: AFTER INSERT su funnemail_actions_log con status='success' → aggiorna sub_status
CREATE OR REPLACE FUNCTION public.funnemail_actions_to_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE public.funnemail_message_status
    SET sub_status = NEW.action,
        status_reason = 'auto: action ' || NEW.action || ' applied',
        status_changed_by = 'system:funnemail-dispatcher',
        status_changed_at = now()
    WHERE message_id = NEW.message_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funnemail_actions_to_status ON public.funnemail_actions_log;
CREATE TRIGGER trg_funnemail_actions_to_status
  AFTER INSERT ON public.funnemail_actions_log
  FOR EACH ROW EXECUTE FUNCTION public.funnemail_actions_to_status();
