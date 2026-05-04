-- Step 2: Funnemail policy schema

ALTER TABLE public.email_sender_groups
  ADD COLUMN IF NOT EXISTS funnemail_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funnemail_policy jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.email_sender_groups.funnemail_policy IS
  'Funnemail per-group AI policy. Shape: {actions:[tag_only|deep_search|draft_reply|crm_update|imap_action], deep_search:{trigger,stale_days,level}, draft_reply:{tone,agent_id}, crm_update:{set_lead_status,create_task}, imap_action:{type}, min_confidence}';

CREATE TABLE IF NOT EXISTS public.funnemail_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  user_id uuid,
  group_id uuid REFERENCES public.email_sender_groups(id) ON DELETE SET NULL,
  from_address text,
  partner_id uuid,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS funnemail_actions_log_msg_action_uq
  ON public.funnemail_actions_log (message_id, action);

CREATE INDEX IF NOT EXISTS funnemail_actions_log_created_idx
  ON public.funnemail_actions_log (created_at DESC);

CREATE INDEX IF NOT EXISTS funnemail_actions_log_group_idx
  ON public.funnemail_actions_log (group_id);

ALTER TABLE public.funnemail_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users can read funnemail actions log"
  ON public.funnemail_actions_log
  FOR SELECT
  TO authenticated
  USING (true);
