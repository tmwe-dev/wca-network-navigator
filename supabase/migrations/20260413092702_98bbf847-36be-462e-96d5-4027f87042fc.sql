
-- ═══ STEP 1: Backfill and enforce user_id on email_drafts ═══
UPDATE email_drafts SET user_id = (SELECT user_id FROM profiles LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE email_drafts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id);

-- ═══ STEP 1b: Backfill reminders user_id ═══
UPDATE reminders SET user_id = COALESCE(
  (SELECT p.user_id FROM partners p WHERE p.id = reminders.partner_id LIMIT 1),
  (SELECT user_id FROM profiles LIMIT 1)
) WHERE user_id IS NULL;
ALTER TABLE reminders ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);

-- ═══ STEP 1c: Index on email_templates user_id ═══
CREATE INDEX IF NOT EXISTS idx_email_templates_user ON email_templates(user_id);

-- ═══ STEP 2: Fix RLS on email_drafts ═══
DROP POLICY IF EXISTS "email_drafts_policy" ON email_drafts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON email_drafts;
DROP POLICY IF EXISTS "Users manage own drafts" ON email_drafts;
DROP POLICY IF EXISTS "Admin sees all drafts" ON email_drafts;
CREATE POLICY "Users manage own drafts" ON email_drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin sees all drafts" ON email_drafts FOR SELECT USING (public.is_operator_admin());

-- ═══ STEP 2b: Fix RLS on email_templates ═══
DROP POLICY IF EXISTS "email_templates_policy" ON email_templates;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON email_templates;
DROP POLICY IF EXISTS "Users manage own templates" ON email_templates;
DROP POLICY IF EXISTS "Admin sees all templates" ON email_templates;
CREATE POLICY "Users manage own templates" ON email_templates FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admin sees all templates" ON email_templates FOR SELECT USING (public.is_operator_admin());

-- ═══ STEP 2c: Fix RLS on reminders ═══
DROP POLICY IF EXISTS "reminders_policy" ON reminders;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON reminders;
DROP POLICY IF EXISTS "Users manage own reminders" ON reminders;
DROP POLICY IF EXISTS "Admin sees all reminders" ON reminders;
CREATE POLICY "Users manage own reminders" ON reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin sees all reminders" ON reminders FOR SELECT USING (public.is_operator_admin());

-- ═══ STEP 2d: Fix RLS on partner_social_links ═══
DROP POLICY IF EXISTS "partner_social_links_policy" ON partner_social_links;
DROP POLICY IF EXISTS "Enable read access for all users" ON partner_social_links;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON partner_social_links;
DROP POLICY IF EXISTS "Users see own partner links" ON partner_social_links;
DROP POLICY IF EXISTS "Admin sees all links" ON partner_social_links;
CREATE POLICY "Authenticated users access partner links" ON partner_social_links FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ═══ STEP 2e: Fix RLS on imported_contacts ═══
DROP POLICY IF EXISTS "imported_contacts_policy" ON imported_contacts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON imported_contacts;
DROP POLICY IF EXISTS "Users manage own contacts" ON imported_contacts;
DROP POLICY IF EXISTS "Admin sees all contacts" ON imported_contacts;
DROP POLICY IF EXISTS "Service role manages contacts" ON imported_contacts;
CREATE POLICY "Users manage own contacts" ON imported_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin sees all contacts" ON imported_contacts FOR SELECT USING (public.is_operator_admin());

-- ═══ STEP 3: Admin override policies on major tables (explicit, no DO block) ═══
DROP POLICY IF EXISTS "Admin full access on partners" ON partners;
CREATE POLICY "Admin full access on partners" ON partners FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on activities" ON activities;
CREATE POLICY "Admin full access on activities" ON activities FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on business_cards" ON business_cards;
CREATE POLICY "Admin full access on business_cards" ON business_cards FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on agents" ON agents;
CREATE POLICY "Admin full access on agents" ON agents FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on agent_tasks" ON agent_tasks;
CREATE POLICY "Admin full access on agent_tasks" ON agent_tasks FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on outreach_missions" ON outreach_missions;
CREATE POLICY "Admin full access on outreach_missions" ON outreach_missions FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on mission_actions" ON mission_actions;
CREATE POLICY "Admin full access on mission_actions" ON mission_actions FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on cockpit_queue" ON cockpit_queue;
CREATE POLICY "Admin full access on cockpit_queue" ON cockpit_queue FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_sync_jobs" ON email_sync_jobs;
CREATE POLICY "Admin full access on email_sync_jobs" ON email_sync_jobs FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_sync_state" ON email_sync_state;
CREATE POLICY "Admin full access on email_sync_state" ON email_sync_state FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_campaign_queue" ON email_campaign_queue;
CREATE POLICY "Admin full access on email_campaign_queue" ON email_campaign_queue FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_address_rules" ON email_address_rules;
CREATE POLICY "Admin full access on email_address_rules" ON email_address_rules FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_prompts" ON email_prompts;
CREATE POLICY "Admin full access on email_prompts" ON email_prompts FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_attachments" ON email_attachments;
CREATE POLICY "Admin full access on email_attachments" ON email_attachments FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on channel_messages" ON channel_messages;
CREATE POLICY "Admin full access on channel_messages" ON channel_messages FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on partner_contacts" ON partner_contacts;
CREATE POLICY "Admin full access on partner_contacts" ON partner_contacts FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on email_classifications" ON email_classifications;
CREATE POLICY "Admin full access on email_classifications" ON email_classifications FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on contact_conversation_context" ON contact_conversation_context;
CREATE POLICY "Admin full access on contact_conversation_context" ON contact_conversation_context FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on ai_decision_log" ON ai_decision_log;
CREATE POLICY "Admin full access on ai_decision_log" ON ai_decision_log FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on ai_pending_actions" ON ai_pending_actions;
CREATE POLICY "Admin full access on ai_pending_actions" ON ai_pending_actions FOR SELECT USING (public.is_operator_admin());

DROP POLICY IF EXISTS "Admin full access on supervisor_audit_log" ON supervisor_audit_log;
CREATE POLICY "Admin full access on supervisor_audit_log" ON supervisor_audit_log FOR SELECT USING (public.is_operator_admin());

-- ═══ STEP 4: Agent-to-Tutor assignment columns ═══
ALTER TABLE agents ADD COLUMN IF NOT EXISTS assigned_tutor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_send_email boolean DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_send_whatsapp boolean DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_access_inbox boolean DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS daily_send_limit integer DEFAULT 50;

-- ═══ STEP 4b: Update agents RLS for tutor visibility ═══
DROP POLICY IF EXISTS "Users see own agents" ON agents;
DROP POLICY IF EXISTS "Users manage own agents" ON agents;
DROP POLICY IF EXISTS "Admin manages all agents" ON agents;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON agents;
CREATE POLICY "Users manage own agents" ON agents FOR ALL USING (auth.uid() = user_id OR auth.uid() = assigned_tutor_id) WITH CHECK (auth.uid() = user_id OR auth.uid() = assigned_tutor_id);
