-- Slot configuration per canale
CREATE TABLE IF NOT EXISTS public.mission_slot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL,
  max_per_hour integer NOT NULL DEFAULT 50,
  max_per_day integer NOT NULL DEFAULT 500,
  concurrent_slots integer NOT NULL DEFAULT 5,
  retry_max integer NOT NULL DEFAULT 3,
  retry_backoff_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);

ALTER TABLE public.mission_slot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own slot config"
  ON public.mission_slot_config FOR SELECT
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "Users can manage their own slot config"
  ON public.mission_slot_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Default configs (system-wide defaults)
INSERT INTO public.mission_slot_config (user_id, channel, max_per_hour, max_per_day, concurrent_slots, retry_max, retry_backoff_minutes)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'email', 50, 500, 5, 3, 15),
  ('00000000-0000-0000-0000-000000000000', 'whatsapp', 20, 200, 3, 3, 15),
  ('00000000-0000-0000-0000-000000000000', 'linkedin', 10, 50, 2, 3, 15)
ON CONFLICT DO NOTHING;

-- Aggiungi campi retry e slot tracking a mission_actions
ALTER TABLE public.mission_actions ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE public.mission_actions ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.mission_actions ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE public.mission_actions ADD COLUMN IF NOT EXISTS slot_acquired_at timestamptz;
ALTER TABLE public.mission_actions ADD COLUMN IF NOT EXISTS slot_released_at timestamptz;

-- Aggiungi progress tracking a outreach_missions
ALTER TABLE public.outreach_missions ADD COLUMN IF NOT EXISTS progress_snapshot jsonb DEFAULT '{}';

-- RPC: acquire slot (atomic with SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.acquire_mission_slot(
  p_mission_id uuid,
  p_channel text,
  p_user_id uuid,
  p_max_concurrent integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action_id uuid;
  v_active_count integer;
BEGIN
  SELECT count(*) INTO v_active_count
  FROM mission_actions
  WHERE user_id = p_user_id
    AND action_type = p_channel
    AND status = 'executing'
    AND slot_acquired_at IS NOT NULL
    AND slot_released_at IS NULL;

  IF v_active_count >= p_max_concurrent THEN
    RETURN NULL;
  END IF;

  UPDATE mission_actions
  SET status = 'executing',
      slot_acquired_at = now()
  WHERE id = (
    SELECT id FROM mission_actions
    WHERE mission_id = p_mission_id
      AND status = 'approved'
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY position ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;

-- RPC: release slot with retry logic
CREATE OR REPLACE FUNCTION public.release_mission_slot(
  p_action_id uuid,
  p_success boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_retry_count integer;
  v_retry_max integer;
  v_backoff integer;
  v_channel text;
  v_user_id uuid;
BEGIN
  SELECT ma.retry_count, ma.action_type, ma.user_id
  INTO v_retry_count, v_channel, v_user_id
  FROM mission_actions ma
  WHERE ma.id = p_action_id;

  SELECT retry_max, retry_backoff_minutes INTO v_retry_max, v_backoff
  FROM mission_slot_config
  WHERE (user_id = v_user_id OR user_id = '00000000-0000-0000-0000-000000000000')
    AND channel = v_channel
  ORDER BY CASE WHEN user_id = v_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_retry_max IS NULL THEN v_retry_max := 3; END IF;
  IF v_backoff IS NULL THEN v_backoff := 15; END IF;

  IF p_success THEN
    UPDATE mission_actions
    SET status = 'completed', slot_released_at = now(), last_error = NULL, completed_at = now()
    WHERE id = p_action_id;
  ELSIF v_retry_count < v_retry_max THEN
    UPDATE mission_actions
    SET status = 'approved',
        slot_released_at = now(),
        retry_count = retry_count + 1,
        last_error = p_error,
        next_retry_at = now() + (v_backoff * (retry_count + 1)) * interval '1 minute'
    WHERE id = p_action_id;
  ELSE
    UPDATE mission_actions
    SET status = 'failed', slot_released_at = now(), last_error = p_error, completed_at = now()
    WHERE id = p_action_id;
  END IF;
END;
$$;

-- RPC: update mission progress snapshot
CREATE OR REPLACE FUNCTION public.update_mission_progress(p_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', count(*),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'executing', count(*) FILTER (WHERE status = 'executing'),
    'approved', count(*) FILTER (WHERE status = 'approved'),
    'retry_pending', count(*) FILTER (WHERE status = 'approved' AND retry_count > 0),
    'updated_at', now()
  ) INTO v_snapshot
  FROM mission_actions
  WHERE mission_id = p_mission_id;

  UPDATE outreach_missions
  SET progress_snapshot = v_snapshot,
      processed_contacts = (v_snapshot->>'completed')::integer + (v_snapshot->>'failed')::integer
  WHERE id = p_mission_id;

  RETURN v_snapshot;
END;
$$;