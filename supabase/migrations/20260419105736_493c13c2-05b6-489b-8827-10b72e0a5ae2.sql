
-- ============================================================================
-- BLOCCO 1 SICUREZZA: hardening RLS
-- 1) user_credits: blocca privilege escalation su balance
-- 2) Backfill operator_id per record legacy assegnabili
-- 3) Stringi policy INSERT/UPDATE rimuovendo bypass "operator_id IS NULL"
--    (mantenuto solo su SELECT per kb_entries dottrina sistema)
-- 4) team_members: writes solo admin
-- 5) blacklist_entries: writes solo admin
-- ============================================================================

-- ─── 1. USER_CREDITS: privilege escalation fix ──────────────────────────────
-- Rimuovo la policy UPDATE diretta. Solo SECURITY DEFINER functions possono
-- modificare il balance (deduct_credits + grant_welcome_credits già esistono).
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;

CREATE POLICY "user_credits_select_own"
  ON public.user_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT solo via trigger handle_new_user (SECURITY DEFINER bypassa RLS)
-- UPDATE/DELETE: nessuna policy = nessuno può, tranne SECURITY DEFINER.

-- Funzione canonica per top-up (admin) — usa SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.topup_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT 'Top-up manuale'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- Solo admin operator può fare top-up arbitrari
  IF NOT public.is_operator_admin() THEN
    RAISE EXCEPTION 'unauthorized: only admin operators can top up credits';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE public.user_credits
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    INSERT INTO public.user_credits(user_id, balance, total_consumed)
    VALUES (p_user_id, p_amount, 0)
    RETURNING balance INTO v_new_balance;
  END IF;

  INSERT INTO public.credit_transactions(user_id, amount, operation, description)
  VALUES (p_user_id, p_amount, 'topup', p_description);

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.topup_credits(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.topup_credits(uuid, integer, text) TO authenticated;

-- ─── 2. BACKFILL operator_id legacy ─────────────────────────────────────────
-- 45 activities + 104 agent_tasks → assegna l'operator del proprio user_id
UPDATE public.activities a
SET operator_id = (SELECT id FROM public.operators o WHERE o.user_id = a.user_id LIMIT 1)
WHERE a.operator_id IS NULL AND a.user_id IS NOT NULL;

UPDATE public.agent_tasks t
SET operator_id = (SELECT id FROM public.operators o WHERE o.user_id = t.user_id LIMIT 1)
WHERE t.operator_id IS NULL AND t.user_id IS NOT NULL;

UPDATE public.kb_entries k
SET operator_id = (SELECT id FROM public.operators o WHERE o.user_id = k.user_id LIMIT 1)
WHERE k.operator_id IS NULL AND k.user_id IS NOT NULL;

-- ─── 3. STRINGI POLICY: rimuovi bypass "operator_id IS NULL" su writes ──────
-- Pattern: SELECT mantiene il bypass (per dottrina sistema), 
--          INSERT/UPDATE/DELETE richiedono operator_id valido.

-- ACTIVITIES
DROP POLICY IF EXISTS activities_insert_own ON public.activities;
DROP POLICY IF EXISTS activities_update_own ON public.activities;
DROP POLICY IF EXISTS activities_delete_own ON public.activities;
CREATE POLICY activities_insert_own ON public.activities FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY activities_update_own ON public.activities FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY activities_delete_own ON public.activities FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- AGENT_TASKS
DROP POLICY IF EXISTS agent_tasks_insert_own ON public.agent_tasks;
DROP POLICY IF EXISTS agent_tasks_update_own ON public.agent_tasks;
DROP POLICY IF EXISTS agent_tasks_delete_own ON public.agent_tasks;
CREATE POLICY agent_tasks_insert_own ON public.agent_tasks FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY agent_tasks_update_own ON public.agent_tasks FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY agent_tasks_delete_own ON public.agent_tasks FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- EMAIL_DRAFTS
DROP POLICY IF EXISTS email_drafts_insert_own ON public.email_drafts;
DROP POLICY IF EXISTS email_drafts_update_own ON public.email_drafts;
DROP POLICY IF EXISTS email_drafts_delete_own ON public.email_drafts;
CREATE POLICY email_drafts_insert_own ON public.email_drafts FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY email_drafts_update_own ON public.email_drafts FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY email_drafts_delete_own ON public.email_drafts FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- EMAIL_TEMPLATES (NB: SELECT mantiene OR IS NULL per template sistema)
DROP POLICY IF EXISTS email_templates_insert_own ON public.email_templates;
DROP POLICY IF EXISTS email_templates_update_own ON public.email_templates;
DROP POLICY IF EXISTS email_templates_delete_own ON public.email_templates;
CREATE POLICY email_templates_insert_own ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY email_templates_update_own ON public.email_templates FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY email_templates_delete_own ON public.email_templates FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- KB_ENTRIES (SELECT lascia OR IS NULL per dottrina sistema)
DROP POLICY IF EXISTS kb_entries_insert_own ON public.kb_entries;
DROP POLICY IF EXISTS kb_entries_update_own ON public.kb_entries;
DROP POLICY IF EXISTS kb_entries_delete_own ON public.kb_entries;
CREATE POLICY kb_entries_insert_own ON public.kb_entries FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY kb_entries_update_own ON public.kb_entries FOR UPDATE TO authenticated
  USING (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY kb_entries_delete_own ON public.kb_entries FOR DELETE TO authenticated
  USING (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));

-- MISSION_ACTIONS
DROP POLICY IF EXISTS mission_actions_insert_own ON public.mission_actions;
DROP POLICY IF EXISTS mission_actions_update_own ON public.mission_actions;
DROP POLICY IF EXISTS mission_actions_delete_own ON public.mission_actions;
CREATE POLICY mission_actions_insert_own ON public.mission_actions FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY mission_actions_update_own ON public.mission_actions FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY mission_actions_delete_own ON public.mission_actions FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- OUTREACH_MISSIONS
DROP POLICY IF EXISTS outreach_missions_insert_own ON public.outreach_missions;
DROP POLICY IF EXISTS outreach_missions_update_own ON public.outreach_missions;
DROP POLICY IF EXISTS outreach_missions_delete_own ON public.outreach_missions;
CREATE POLICY outreach_missions_insert_own ON public.outreach_missions FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY outreach_missions_update_own ON public.outreach_missions FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY outreach_missions_delete_own ON public.outreach_missions FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- OUTREACH_QUEUE
DROP POLICY IF EXISTS outreach_queue_insert_own ON public.outreach_queue;
DROP POLICY IF EXISTS outreach_queue_update_own ON public.outreach_queue;
DROP POLICY IF EXISTS outreach_queue_delete_own ON public.outreach_queue;
CREATE POLICY outreach_queue_insert_own ON public.outreach_queue FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY outreach_queue_update_own ON public.outreach_queue FOR UPDATE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(get_effective_operator_ids()));
CREATE POLICY outreach_queue_delete_own ON public.outreach_queue FOR DELETE TO authenticated
  USING (operator_id = ANY(get_effective_operator_ids()));

-- ─── 4. TEAM_MEMBERS: writes solo admin ────────────────────────────────────
DROP POLICY IF EXISTS team_members_insert_admin ON public.team_members;
DROP POLICY IF EXISTS team_members_update_admin ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_admin ON public.team_members;
CREATE POLICY team_members_insert_admin ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_admin());
CREATE POLICY team_members_update_admin ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_operator_admin()) WITH CHECK (public.is_operator_admin());
CREATE POLICY team_members_delete_admin ON public.team_members FOR DELETE TO authenticated
  USING (public.is_operator_admin());

-- ─── 5. BLACKLIST_ENTRIES: writes solo admin ───────────────────────────────
DROP POLICY IF EXISTS blacklist_entries_insert_admin ON public.blacklist_entries;
DROP POLICY IF EXISTS blacklist_entries_update_admin ON public.blacklist_entries;
DROP POLICY IF EXISTS blacklist_entries_delete_admin ON public.blacklist_entries;
CREATE POLICY blacklist_entries_insert_admin ON public.blacklist_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_operator_admin());
CREATE POLICY blacklist_entries_update_admin ON public.blacklist_entries FOR UPDATE TO authenticated
  USING (public.is_operator_admin()) WITH CHECK (public.is_operator_admin());
CREATE POLICY blacklist_entries_delete_admin ON public.blacklist_entries FOR DELETE TO authenticated
  USING (public.is_operator_admin());

-- ─── 6. CHANNEL_MESSAGES: già stretto, normalizzo ruolo ────────────────────
-- (sono già operator_id NOT NULL — niente da fare, sono già OK)

-- ─── 7. Trigger BEFORE INSERT: auto-set operator_id ────────────────────────
CREATE OR REPLACE FUNCTION public.auto_set_operator_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.operator_id IS NULL THEN
    NEW.operator_id := public.get_active_operator_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'activities','agent_tasks','email_drafts','email_templates',
    'kb_entries','mission_actions','outreach_missions','outreach_queue',
    'channel_messages'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_operator_id ON public.%I;
       CREATE TRIGGER trg_auto_operator_id
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.auto_set_operator_id();',
      t, t
    );
  END LOOP;
END$$;
