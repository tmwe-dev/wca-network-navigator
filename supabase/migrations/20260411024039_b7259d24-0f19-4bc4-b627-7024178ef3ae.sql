
-- ═══════════════════════════════════════════════════════════════
-- RLS SECURITY HARDENING: Fix permissive "true" policies
-- ═══════════════════════════════════════════════════════════════

-- 1. BUSINESS_CARDS: restrict to owner
DROP POLICY IF EXISTS "Authenticated users can read business_cards" ON public.business_cards;
DROP POLICY IF EXISTS "Authenticated users can update business_cards" ON public.business_cards;
DROP POLICY IF EXISTS "Authenticated users can delete business_cards" ON public.business_cards;
CREATE POLICY "Owner can read business_cards" ON public.business_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can update business_cards" ON public.business_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete business_cards" ON public.business_cards FOR DELETE USING (auth.uid() = user_id);

-- 2. IMPORTED_CONTACTS: remove overly broad policy
DROP POLICY IF EXISTS "auth_imported_contacts_all" ON public.imported_contacts;

-- 3. IMPORT_LOGS: remove overly broad policy
DROP POLICY IF EXISTS "auth_import_logs_all" ON public.import_logs;

-- 4. IMPORT_ERRORS: remove overly broad policy
DROP POLICY IF EXISTS "auth_import_errors_all" ON public.import_errors;

-- 5. EMAIL_CAMPAIGN_QUEUE: remove NULL user_id exception
DROP POLICY IF EXISTS "ecq_select" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "ecq_update" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "user_email_campaign_queue_select" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "user_email_campaign_queue_update" ON public.email_campaign_queue;
CREATE POLICY "ecq_owner_select" ON public.email_campaign_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ecq_owner_update" ON public.email_campaign_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 6. BLACKLIST_ENTRIES: restrict insert/update (keep select open for all authenticated)
DROP POLICY IF EXISTS "bl_insert" ON public.blacklist_entries;
DROP POLICY IF EXISTS "bl_update" ON public.blacklist_entries;
DROP POLICY IF EXISTS "auth_blacklist_entries_all" ON public.blacklist_entries;
CREATE POLICY "bl_auth_select" ON public.blacklist_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "bl_auth_insert" ON public.blacklist_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bl_auth_update" ON public.blacklist_entries FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- 7. DOWNLOAD_JOBS: remove NULL user_id exception
DROP POLICY IF EXISTS "dj_select" ON public.download_jobs;
DROP POLICY IF EXISTS "dj_update" ON public.download_jobs;
CREATE POLICY "dj_owner_select" ON public.download_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dj_owner_update" ON public.download_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 8. DOWNLOAD_QUEUE: remove NULL user_id exception
DROP POLICY IF EXISTS "dq_select" ON public.download_queue;
DROP POLICY IF EXISTS "dq_update" ON public.download_queue;
DROP POLICY IF EXISTS "user_download_queue_insert" ON public.download_queue;
DROP POLICY IF EXISTS "user_download_queue_update" ON public.download_queue;
DROP POLICY IF EXISTS "user_download_queue_delete" ON public.download_queue;
CREATE POLICY "dq_owner_select" ON public.download_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dq_owner_update" ON public.download_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dq_owner_insert" ON public.download_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dq_owner_delete" ON public.download_queue FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 9. PROSPECTS: add user_id and restrict
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "prospects_select" ON public.prospects;
DROP POLICY IF EXISTS "prospects_insert" ON public.prospects;
DROP POLICY IF EXISTS "prospects_update" ON public.prospects;
DROP POLICY IF EXISTS "prospects_delete" ON public.prospects;
CREATE POLICY "prospects_owner_select" ON public.prospects FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "prospects_owner_insert" ON public.prospects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prospects_owner_update" ON public.prospects FOR UPDATE TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "prospects_owner_delete" ON public.prospects FOR DELETE TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- 10. PROSPECT_CONTACTS: add user_id and restrict
ALTER TABLE public.prospect_contacts ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "pc_all" ON public.prospect_contacts;
CREATE POLICY "pc_owner_all" ON public.prospect_contacts FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id);

-- 11. PROSPECT_INTERACTIONS: add user_id and restrict
ALTER TABLE public.prospect_interactions ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "pi_all" ON public.prospect_interactions;
CREATE POLICY "pi_owner_all" ON public.prospect_interactions FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id);

-- 12. PROSPECT_SOCIAL_LINKS: add user_id and restrict
ALTER TABLE public.prospect_social_links ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "auth_prospect_social_links_all" ON public.prospect_social_links;
DROP POLICY IF EXISTS "psl_all" ON public.prospect_social_links;
CREATE POLICY "psl_owner_all" ON public.prospect_social_links FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id);

-- 13. EMAIL_DRAFTS: add user_id and restrict
ALTER TABLE public.email_drafts ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "ed_all" ON public.email_drafts;
CREATE POLICY "ed_owner_all" ON public.email_drafts FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id);

-- 14. EMAIL_TEMPLATES: add user_id and restrict
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "et_select" ON public.email_templates;
DROP POLICY IF EXISTS "et_insert" ON public.email_templates;
DROP POLICY IF EXISTS "et_update" ON public.email_templates;
DROP POLICY IF EXISTS "et_delete" ON public.email_templates;
CREATE POLICY "et_owner_select" ON public.email_templates FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "et_owner_insert" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "et_owner_update" ON public.email_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "et_owner_delete" ON public.email_templates FOR DELETE TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- 15. NETWORK_CONFIGS: add user_id and restrict
ALTER TABLE public.network_configs ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "nc_select" ON public.network_configs;
DROP POLICY IF EXISTS "nc_insert" ON public.network_configs;
DROP POLICY IF EXISTS "nc_update" ON public.network_configs;
CREATE POLICY "nc_owner_select" ON public.network_configs FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "nc_owner_insert" ON public.network_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nc_owner_update" ON public.network_configs FOR UPDATE TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
