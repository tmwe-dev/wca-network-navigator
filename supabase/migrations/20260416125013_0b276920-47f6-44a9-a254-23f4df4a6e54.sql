
-- A1. Tabella cursore backfill
CREATE TABLE IF NOT EXISTS public.channel_backfill_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','linkedin','email')),
  external_chat_id text NOT NULL,
  chat_display_name text,
  oldest_message_external_id text,
  oldest_message_at timestamptz,
  newest_message_external_id text,
  newest_message_at timestamptz,
  messages_imported int NOT NULL DEFAULT 0,
  reached_beginning boolean NOT NULL DEFAULT false,
  last_attempt_at timestamptz,
  last_attempt_status text CHECK (last_attempt_status IN ('ok','partial','error') OR last_attempt_status IS NULL),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, channel, external_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_cbs_operator_channel
  ON public.channel_backfill_state(operator_id, channel);

CREATE INDEX IF NOT EXISTS idx_cbs_reached
  ON public.channel_backfill_state(operator_id, channel) WHERE reached_beginning = false;

-- A2. RLS
ALTER TABLE public.channel_backfill_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cbs_select_own ON public.channel_backfill_state;
DROP POLICY IF EXISTS cbs_insert_own ON public.channel_backfill_state;
DROP POLICY IF EXISTS cbs_update_own ON public.channel_backfill_state;
DROP POLICY IF EXISTS cbs_delete_own ON public.channel_backfill_state;

CREATE POLICY cbs_select_own ON public.channel_backfill_state FOR SELECT TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY cbs_insert_own ON public.channel_backfill_state FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY cbs_update_own ON public.channel_backfill_state FOR UPDATE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY cbs_delete_own ON public.channel_backfill_state FOR DELETE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));

-- A3. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cbs_updated ON public.channel_backfill_state;
CREATE TRIGGER trg_cbs_updated BEFORE UPDATE ON public.channel_backfill_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A4. Seed cursori da messaggi esistenti (usa colonne reali: thread_id, from_address, created_at)
INSERT INTO public.channel_backfill_state (
  operator_id, channel, external_chat_id, chat_display_name,
  oldest_message_external_id, oldest_message_at,
  newest_message_external_id, newest_message_at,
  messages_imported, last_attempt_at, last_attempt_status
)
SELECT
  cm.operator_id,
  cm.channel,
  COALESCE(cm.thread_id, 'unknown'),
  MAX(cm.from_address),
  (array_agg(cm.message_id_external ORDER BY cm.created_at ASC))[1],
  MIN(cm.created_at),
  (array_agg(cm.message_id_external ORDER BY cm.created_at DESC))[1],
  MAX(cm.created_at),
  COUNT(*)::int,
  now(),
  'ok'
FROM public.channel_messages cm
WHERE cm.channel IN ('whatsapp','linkedin')
  AND cm.operator_id IS NOT NULL
  AND cm.thread_id IS NOT NULL
GROUP BY cm.operator_id, cm.channel, cm.thread_id
ON CONFLICT (operator_id, channel, external_chat_id) DO NOTHING;
