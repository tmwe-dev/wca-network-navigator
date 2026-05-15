
-- P0 Funnemail RLS Lockdown: meta-leak fix
-- Ogni operatore vede solo le decision/log/status delle email che già può leggere
-- via RLS di channel_messages (operator_id = ANY get_effective_operator_ids()).

-- Helper security definer: visibilità sul channel_message sottostante
CREATE OR REPLACE FUNCTION public.can_see_channel_message_text(p_message_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_messages cm
    WHERE cm.id::text = p_message_id
      AND cm.deleted_at IS NULL
      AND cm.operator_id = ANY(public.get_effective_operator_ids())
  );
$$;

-- funnemail_decisions
DROP POLICY IF EXISTS "funnemail_decisions read all auth" ON public.funnemail_decisions;
CREATE POLICY "funnemail_decisions select scoped"
  ON public.funnemail_decisions FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- funnemail_actions_log
DROP POLICY IF EXISTS "auth users can read funnemail actions log" ON public.funnemail_actions_log;
CREATE POLICY "funnemail_actions_log select scoped"
  ON public.funnemail_actions_log FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- funnemail_message_status
DROP POLICY IF EXISTS "fms_select_all_auth" ON public.funnemail_message_status;
CREATE POLICY "funnemail_message_status select scoped"
  ON public.funnemail_message_status FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- funnemail_message_status_history
DROP POLICY IF EXISTS "fmsh_select_all_auth" ON public.funnemail_message_status_history;
CREATE POLICY "funnemail_message_status_history select scoped"
  ON public.funnemail_message_status_history FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- funnemail_message_reminders
DROP POLICY IF EXISTS "fmr_select_all_auth" ON public.funnemail_message_reminders;
CREATE POLICY "funnemail_message_reminders select scoped"
  ON public.funnemail_message_reminders FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- funnemail_escalation_events
DROP POLICY IF EXISTS "fee_select_auth" ON public.funnemail_escalation_events;
CREATE POLICY "funnemail_escalation_events select scoped"
  ON public.funnemail_escalation_events FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- funnemail_message_claims: i claim devono restare visibili a tutti gli operatori
-- che possono vedere il messaggio (per banner "presa in carico").
DROP POLICY IF EXISTS "Authenticated can view all claims" ON public.funnemail_message_claims;
CREATE POLICY "funnemail_message_claims select scoped"
  ON public.funnemail_message_claims FOR SELECT TO authenticated
  USING (public.can_see_channel_message_text(message_id));

-- Tabelle puramente di configurazione/qualità (folders, eval, autoresponder templates,
-- sender_intel) restano leggibili a tutti gli auth: sono catalogo, non dati personali.
