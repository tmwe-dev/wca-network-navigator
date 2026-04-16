-- M10: channel_messages multi-tenant routing per operatore.

-- STEP 0a: elimina i 1754 duplicati legacy (stesse email scaricate da entrambi gli account)
DELETE FROM public.channel_messages
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'lucaarcana@gmail.com')
  AND message_id_external IN (
    SELECT message_id_external FROM public.channel_messages
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'luca@tmwe.it')
      AND message_id_external IS NOT NULL
  );

-- STEP 0b: riassegna le restanti ~2604 email uniche al login corrente
UPDATE public.channel_messages
SET user_id = (SELECT id FROM auth.users WHERE email = 'luca@tmwe.it')
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'lucaarcana@gmail.com');

-- STEP 1: helper function lookup operator via identificatore canale
CREATE OR REPLACE FUNCTION public.get_operator_id_by_identifier(
  p_channel text,
  p_identifier text
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.operators
  WHERE is_active = true
    AND (
      (p_channel = 'email' AND p_identifier IS NOT NULL AND (
        lower(imap_user) = lower(p_identifier)
        OR lower(smtp_user) = lower(p_identifier)
        OR lower(email) = lower(p_identifier)
      ))
      OR (p_channel = 'whatsapp' AND p_identifier IS NOT NULL
          AND whatsapp_phone = p_identifier)
      OR (p_channel = 'linkedin' AND p_identifier IS NOT NULL
          AND linkedin_profile_url = p_identifier)
    )
  LIMIT 1;
$$;

-- STEP 2: backfill operator_id dal mapping user_id -> operators.user_id
UPDATE public.channel_messages cm
SET operator_id = o.id
FROM public.operators o
WHERE o.user_id = cm.user_id
  AND cm.operator_id IS NULL
  AND cm.user_id IS NOT NULL;

-- STEP 3: DEFAULT su operator_id per INSERT futuri dal frontend
ALTER TABLE public.channel_messages
  ALTER COLUMN operator_id SET DEFAULT public.get_current_operator_id();

-- STEP 4: index parziale su operator_id
CREATE INDEX IF NOT EXISTS idx_channel_messages_operator_id
  ON public.channel_messages(operator_id)
  WHERE operator_id IS NOT NULL;

-- STEP 5: drop policy esistenti
DO $$
DECLARE p_name text;
BEGIN
  FOR p_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channel_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.channel_messages', p_name);
  END LOOP;
END $$;

-- STEP 6: nuove policy operator-scoped STRICT
CREATE POLICY channel_messages_select_own ON public.channel_messages
  FOR SELECT TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY channel_messages_insert_own ON public.channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY channel_messages_update_own ON public.channel_messages
  FOR UPDATE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(public.get_effective_operator_ids()));

CREATE POLICY channel_messages_delete_own ON public.channel_messages
  FOR DELETE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));