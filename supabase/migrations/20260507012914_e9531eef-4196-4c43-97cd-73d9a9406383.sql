
CREATE TABLE IF NOT EXISTS public.funnemail_routing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  generic_domains text[] NOT NULL DEFAULT ARRAY[
    'gmail.com','googlemail.com','outlook.com','hotmail.com','live.com',
    'libero.it','virgilio.it','tiscali.it','alice.it','tin.it',
    'yahoo.com','yahoo.it','aol.com','icloud.com','me.com',
    'proton.me','protonmail.com','gmx.com','gmx.de','mail.com','pec.it'
  ]::text[],
  generic_domain_min_confidence numeric(4,3) NOT NULL DEFAULT 0.95,
  escalation_l2_minutes integer NOT NULL DEFAULT 30,
  escalation_l3_minutes integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id)
);
ALTER TABLE public.funnemail_routing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frc_select_own" ON public.funnemail_routing_config;
DROP POLICY IF EXISTS "frc_insert_own" ON public.funnemail_routing_config;
DROP POLICY IF EXISTS "frc_update_own" ON public.funnemail_routing_config;
CREATE POLICY "frc_select_own" ON public.funnemail_routing_config FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "frc_insert_own" ON public.funnemail_routing_config FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "frc_update_own" ON public.funnemail_routing_config FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.funnemail_escalation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  user_id uuid NOT NULL,
  level text NOT NULL CHECK (level IN ('L1','L2','L3')),
  reason text,
  target_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fee_message ON public.funnemail_escalation_events(message_id, dispatched_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_user_level ON public.funnemail_escalation_events(user_id, level) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_message_level ON public.funnemail_escalation_events(message_id, level) WHERE deleted_at IS NULL;
ALTER TABLE public.funnemail_escalation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fee_select_auth" ON public.funnemail_escalation_events;
DROP POLICY IF EXISTS "fee_insert_auth" ON public.funnemail_escalation_events;
CREATE POLICY "fee_select_auth" ON public.funnemail_escalation_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_insert_auth" ON public.funnemail_escalation_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.funnemail_message_status ADD COLUMN IF NOT EXISTS sub_status text;
COMMENT ON COLUMN public.funnemail_message_status.sub_status IS
  'Fine-grained sub-status: unassigned|assigned|in_progress|waiting_external|waiting_internal|blocked|closed_done|closed_dropped';

CREATE OR REPLACE VIEW public.funnemail_jobs_v AS
SELECT
  s.message_id,
  s.user_id,
  s.group_id,
  s.status,
  s.sub_status,
  s.status_reason,
  s.changed_by AS status_changed_by,
  s.changed_at AS status_changed_at,
  c.message_id IS NOT NULL AS has_active_claim,
  c.claimed_by AS claim_owner,
  c.claimed_at AS claim_at,
  c.released_at AS claim_released_at,
  d.suggested_action AS ai_suggested_action,
  d.urgency AS ai_urgency,
  d.goes_to_agenda AS ai_goes_to_agenda,
  d.commercial_handoff AS ai_commercial_handoff,
  d.confidence AS ai_confidence,
  d.folder_slug AS ai_folder_slug,
  r.next_remind_at,
  r.open_reminders_count,
  e.last_escalation_level,
  e.last_escalation_at
FROM public.funnemail_message_status s
LEFT JOIN LATERAL (
  SELECT fc.message_id, fc.claimed_by, fc.claimed_at, fc.released_at
  FROM public.funnemail_message_claims fc
  WHERE fc.message_id = s.message_id AND fc.released_at IS NULL
  ORDER BY fc.claimed_at DESC LIMIT 1
) c ON true
LEFT JOIN public.funnemail_decisions d ON d.message_id = s.message_id
LEFT JOIN LATERAL (
  SELECT
    MIN(remind_at) FILTER (WHERE triggered_at IS NULL AND dismissed_at IS NULL) AS next_remind_at,
    COUNT(*) FILTER (WHERE triggered_at IS NULL AND dismissed_at IS NULL) AS open_reminders_count
  FROM public.funnemail_message_reminders fr
  WHERE fr.message_id = s.message_id AND fr.deleted_at IS NULL
) r ON true
LEFT JOIN LATERAL (
  SELECT level AS last_escalation_level, dispatched_at AS last_escalation_at
  FROM public.funnemail_escalation_events fe
  WHERE fe.message_id = s.message_id AND fe.deleted_at IS NULL
  ORDER BY dispatched_at DESC LIMIT 1
) e ON true
WHERE s.deleted_at IS NULL;

COMMENT ON VIEW public.funnemail_jobs_v IS
  'Vista aggregata read-only del job operativo Funnemail (Cr4 audit).';
GRANT SELECT ON public.funnemail_jobs_v TO authenticated;
