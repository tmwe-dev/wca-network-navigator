-- 1) Risk taxonomy enum
DO $$ BEGIN
  CREATE TYPE public.ai_action_risk AS ENUM ('READ','PREPARE','WRITE','SEND','EXTERNAL_AUTOMATION','BULK','DESTRUCTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Two-phase commit fields on ai_pending_actions
ALTER TABLE public.ai_pending_actions
  ADD COLUMN IF NOT EXISTS risk_level public.ai_action_risk NOT NULL DEFAULT 'WRITE',
  ADD COLUMN IF NOT EXISTS executing_since timestamptz,
  ADD COLUMN IF NOT EXISTS execution_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS hard_gate_check jsonb DEFAULT '{}'::jsonb;

-- Allow 'executing' and 'failed' status
ALTER TABLE public.ai_pending_actions DROP CONSTRAINT IF EXISTS ai_pending_actions_status_check;
ALTER TABLE public.ai_pending_actions
  ADD CONSTRAINT ai_pending_actions_status_check
  CHECK (status IN ('pending','approved','executing','executed','failed','rejected','expired','cancelled'));

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_executing
  ON public.ai_pending_actions (status, executing_since)
  WHERE status = 'executing';

-- 3) Atomic claim helper (two-phase commit start)
CREATE OR REPLACE FUNCTION public.claim_pending_action(_action_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed boolean := false;
BEGIN
  UPDATE public.ai_pending_actions
     SET status = 'executing',
         executing_since = now(),
         execution_attempts = execution_attempts + 1
   WHERE id = _action_id
     AND status IN ('pending','approved','failed')
  RETURNING true INTO _claimed;
  RETURN COALESCE(_claimed, false);
END;
$$;

-- 4) Reaper for stuck executing > 5 min (manual call / cron)
CREATE OR REPLACE FUNCTION public.reap_stuck_executing_actions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.ai_pending_actions
     SET status = 'failed',
         last_error = COALESCE(last_error,'') || ' [reaped: stuck>5min]'
   WHERE status = 'executing'
     AND executing_since < now() - interval '5 minutes';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- 5) Hard gate function: blocks SEND/BULK against blacklisted/archived leads
CREATE OR REPLACE FUNCTION public.ai_action_hard_gate(
  _risk public.ai_action_risk,
  _partner_id uuid,
  _contact_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead_status text;
  _blacklisted boolean := false;
  _result jsonb := jsonb_build_object('allowed', true);
BEGIN
  IF _risk NOT IN ('SEND','BULK','EXTERNAL_AUTOMATION','DESTRUCTIVE') THEN
    RETURN _result;
  END IF;

  IF _partner_id IS NOT NULL THEN
    SELECT lead_status INTO _lead_status
      FROM public.partners
     WHERE id = _partner_id;
    IF _lead_status IN ('blacklisted','archived') THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'partner_lead_status='||_lead_status);
    END IF;
  END IF;

  IF _contact_id IS NOT NULL THEN
    SELECT (blacklist_status IS NOT NULL AND blacklist_status <> 'none')
      INTO _blacklisted
      FROM public.partner_contacts
     WHERE id = _contact_id;
    IF COALESCE(_blacklisted,false) THEN
      RETURN jsonb_build_object('allowed', false, 'reason','contact_blacklisted');
    END IF;
  END IF;

  RETURN _result;
END;
$$;