
-- ══════════════════════════════════════════════════════════════
-- Fix: Replace all USING(true) RLS policies with auth requirement
-- Tables with proper user-scoped RLS are NOT touched.
-- ══════════════════════════════════════════════════════════════

-- ── Type A: Tables with individual SELECT/INSERT/UPDATE/DELETE policies ──

-- activities
DROP POLICY IF EXISTS "public_activities_select" ON public.activities;
DROP POLICY IF EXISTS "public_activities_insert" ON public.activities;
DROP POLICY IF EXISTS "public_activities_update" ON public.activities;
DROP POLICY IF EXISTS "public_activities_delete" ON public.activities;
CREATE POLICY "auth_activities_select" ON public.activities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_activities_insert" ON public.activities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_activities_update" ON public.activities FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_activities_delete" ON public.activities FOR DELETE USING (auth.uid() IS NOT NULL);

-- campaign_jobs
DROP POLICY IF EXISTS "public_campaign_jobs_select" ON public.campaign_jobs;
DROP POLICY IF EXISTS "public_campaign_jobs_insert" ON public.campaign_jobs;
DROP POLICY IF EXISTS "public_campaign_jobs_update" ON public.campaign_jobs;
DROP POLICY IF EXISTS "public_campaign_jobs_delete" ON public.campaign_jobs;
CREATE POLICY "auth_campaign_jobs_select" ON public.campaign_jobs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_campaign_jobs_insert" ON public.campaign_jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_campaign_jobs_update" ON public.campaign_jobs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_campaign_jobs_delete" ON public.campaign_jobs FOR DELETE USING (auth.uid() IS NOT NULL);

-- download_queue
DROP POLICY IF EXISTS "public_download_queue_select" ON public.download_queue;
DROP POLICY IF EXISTS "public_download_queue_insert" ON public.download_queue;
DROP POLICY IF EXISTS "public_download_queue_update" ON public.download_queue;
DROP POLICY IF EXISTS "public_download_queue_delete" ON public.download_queue;
CREATE POLICY "auth_download_queue_select" ON public.download_queue FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_download_queue_insert" ON public.download_queue FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_download_queue_update" ON public.download_queue FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_download_queue_delete" ON public.download_queue FOR DELETE USING (auth.uid() IS NOT NULL);

-- interactions
DROP POLICY IF EXISTS "public_interactions_select" ON public.interactions;
DROP POLICY IF EXISTS "public_interactions_insert" ON public.interactions;
DROP POLICY IF EXISTS "public_interactions_update" ON public.interactions;
DROP POLICY IF EXISTS "public_interactions_delete" ON public.interactions;
CREATE POLICY "auth_interactions_select" ON public.interactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_interactions_insert" ON public.interactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_interactions_update" ON public.interactions FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_interactions_delete" ON public.interactions FOR DELETE USING (auth.uid() IS NOT NULL);

-- network_configs
DROP POLICY IF EXISTS "public_network_configs_select" ON public.network_configs;
DROP POLICY IF EXISTS "public_network_configs_insert" ON public.network_configs;
DROP POLICY IF EXISTS "public_network_configs_update" ON public.network_configs;
DROP POLICY IF EXISTS "public_network_configs_delete" ON public.network_configs;
CREATE POLICY "auth_network_configs_select" ON public.network_configs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_network_configs_insert" ON public.network_configs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_network_configs_update" ON public.network_configs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_network_configs_delete" ON public.network_configs FOR DELETE USING (auth.uid() IS NOT NULL);

-- partner_certifications
DROP POLICY IF EXISTS "public_partner_certifications_select" ON public.partner_certifications;
DROP POLICY IF EXISTS "public_partner_certifications_insert" ON public.partner_certifications;
DROP POLICY IF EXISTS "public_partner_certifications_update" ON public.partner_certifications;
DROP POLICY IF EXISTS "public_partner_certifications_delete" ON public.partner_certifications;
CREATE POLICY "auth_partner_certifications_select" ON public.partner_certifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_certifications_insert" ON public.partner_certifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_certifications_update" ON public.partner_certifications FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_certifications_delete" ON public.partner_certifications FOR DELETE USING (auth.uid() IS NOT NULL);

-- partner_contacts
DROP POLICY IF EXISTS "public_partner_contacts_select" ON public.partner_contacts;
DROP POLICY IF EXISTS "public_partner_contacts_insert" ON public.partner_contacts;
DROP POLICY IF EXISTS "public_partner_contacts_update" ON public.partner_contacts;
DROP POLICY IF EXISTS "public_partner_contacts_delete" ON public.partner_contacts;
CREATE POLICY "auth_partner_contacts_select" ON public.partner_contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_contacts_insert" ON public.partner_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_contacts_update" ON public.partner_contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_contacts_delete" ON public.partner_contacts FOR DELETE USING (auth.uid() IS NOT NULL);

-- partner_networks
DROP POLICY IF EXISTS "public_partner_networks_select" ON public.partner_networks;
DROP POLICY IF EXISTS "public_partner_networks_insert" ON public.partner_networks;
DROP POLICY IF EXISTS "public_partner_networks_update" ON public.partner_networks;
DROP POLICY IF EXISTS "public_partner_networks_delete" ON public.partner_networks;
CREATE POLICY "auth_partner_networks_select" ON public.partner_networks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_networks_insert" ON public.partner_networks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_networks_update" ON public.partner_networks FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_networks_delete" ON public.partner_networks FOR DELETE USING (auth.uid() IS NOT NULL);

-- partner_services
DROP POLICY IF EXISTS "public_partner_services_select" ON public.partner_services;
DROP POLICY IF EXISTS "public_partner_services_insert" ON public.partner_services;
DROP POLICY IF EXISTS "public_partner_services_update" ON public.partner_services;
DROP POLICY IF EXISTS "public_partner_services_delete" ON public.partner_services;
CREATE POLICY "auth_partner_services_select" ON public.partner_services FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_services_insert" ON public.partner_services FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_services_update" ON public.partner_services FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_services_delete" ON public.partner_services FOR DELETE USING (auth.uid() IS NOT NULL);

-- partner_social_links
DROP POLICY IF EXISTS "public_partner_social_links_select" ON public.partner_social_links;
DROP POLICY IF EXISTS "public_partner_social_links_insert" ON public.partner_social_links;
DROP POLICY IF EXISTS "public_partner_social_links_update" ON public.partner_social_links;
DROP POLICY IF EXISTS "public_partner_social_links_delete" ON public.partner_social_links;
CREATE POLICY "auth_partner_social_links_select" ON public.partner_social_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_social_links_insert" ON public.partner_social_links FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_social_links_update" ON public.partner_social_links FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partner_social_links_delete" ON public.partner_social_links FOR DELETE USING (auth.uid() IS NOT NULL);

-- partners
DROP POLICY IF EXISTS "public_partners_select" ON public.partners;
DROP POLICY IF EXISTS "public_partners_insert" ON public.partners;
DROP POLICY IF EXISTS "public_partners_update" ON public.partners;
DROP POLICY IF EXISTS "public_partners_delete" ON public.partners;
CREATE POLICY "auth_partners_select" ON public.partners FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partners_insert" ON public.partners FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partners_update" ON public.partners FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_partners_delete" ON public.partners FOR DELETE USING (auth.uid() IS NOT NULL);

-- reminders
DROP POLICY IF EXISTS "public_reminders_select" ON public.reminders;
DROP POLICY IF EXISTS "public_reminders_insert" ON public.reminders;
DROP POLICY IF EXISTS "public_reminders_update" ON public.reminders;
DROP POLICY IF EXISTS "public_reminders_delete" ON public.reminders;
CREATE POLICY "auth_reminders_select" ON public.reminders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_reminders_insert" ON public.reminders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_reminders_update" ON public.reminders FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_reminders_delete" ON public.reminders FOR DELETE USING (auth.uid() IS NOT NULL);

-- team_members
DROP POLICY IF EXISTS "public_team_members_select" ON public.team_members;
DROP POLICY IF EXISTS "public_team_members_insert" ON public.team_members;
DROP POLICY IF EXISTS "public_team_members_update" ON public.team_members;
DROP POLICY IF EXISTS "public_team_members_delete" ON public.team_members;
CREATE POLICY "auth_team_members_select" ON public.team_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_team_members_insert" ON public.team_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_team_members_update" ON public.team_members FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_team_members_delete" ON public.team_members FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── Type B: Tables with single ALL policy ──

-- app_settings
DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;
CREATE POLICY "auth_app_settings_all" ON public.app_settings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- blacklist_entries
DROP POLICY IF EXISTS "Allow all on blacklist_entries" ON public.blacklist_entries;
CREATE POLICY "auth_blacklist_entries_all" ON public.blacklist_entries FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- blacklist_sync_log
DROP POLICY IF EXISTS "Allow all on blacklist_sync_log" ON public.blacklist_sync_log;
CREATE POLICY "auth_blacklist_sync_log_all" ON public.blacklist_sync_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- directory_cache
DROP POLICY IF EXISTS "Allow all on directory_cache" ON public.directory_cache;
CREATE POLICY "auth_directory_cache_all" ON public.directory_cache FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- download_jobs
DROP POLICY IF EXISTS "Allow all on download_jobs" ON public.download_jobs;
CREATE POLICY "auth_download_jobs_all" ON public.download_jobs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- email_templates
DROP POLICY IF EXISTS "Allow all on email_templates" ON public.email_templates;
CREATE POLICY "auth_email_templates_all" ON public.email_templates FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- partners_no_contacts
DROP POLICY IF EXISTS "Allow all on partners_no_contacts" ON public.partners_no_contacts;
CREATE POLICY "auth_partners_no_contacts_all" ON public.partners_no_contacts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- prospect_contacts
DROP POLICY IF EXISTS "Allow all on prospect_contacts" ON public.prospect_contacts;
CREATE POLICY "auth_prospect_contacts_all" ON public.prospect_contacts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- prospect_social_links
DROP POLICY IF EXISTS "Allow all on prospect_social_links" ON public.prospect_social_links;
CREATE POLICY "auth_prospect_social_links_all" ON public.prospect_social_links FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- prospects
DROP POLICY IF EXISTS "Allow all on prospects" ON public.prospects;
CREATE POLICY "auth_prospects_all" ON public.prospects FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
