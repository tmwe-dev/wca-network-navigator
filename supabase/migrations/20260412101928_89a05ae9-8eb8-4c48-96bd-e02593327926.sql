-- NOTE: partners, blacklist_entries, download_job_events, download_job_items,
-- import_errors, partners_no_contacts, prospects, team_members
-- remain with auth.uid() IS NOT NULL because they lack user_id column.
-- These need a data model change (add team_id) in a future migration.

-- ═══════════════════════════════════════════════════════════════
-- Fix RLS policies: scope data access to owning user_id
-- ═══════════════════════════════════════════════════════════════

-- 1. activities
DROP POLICY IF EXISTS "auth_activities_select" ON activities;
CREATE POLICY "auth_activities_select" ON activities FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. app_settings (all operations)
DROP POLICY IF EXISTS "auth_app_settings_all" ON app_settings;
CREATE POLICY "auth_app_settings_select" ON app_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_app_settings_insert" ON app_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_app_settings_update" ON app_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_app_settings_delete" ON app_settings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. campaign_jobs
DROP POLICY IF EXISTS "auth_campaign_jobs_select" ON campaign_jobs;
CREATE POLICY "auth_campaign_jobs_select" ON campaign_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. directory_cache (all operations)
DROP POLICY IF EXISTS "auth_directory_cache_all" ON directory_cache;
CREATE POLICY "auth_directory_cache_select" ON directory_cache FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_directory_cache_insert" ON directory_cache FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_directory_cache_update" ON directory_cache FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_directory_cache_delete" ON directory_cache FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5. download_jobs (all operations)
DROP POLICY IF EXISTS "auth_download_jobs_all" ON download_jobs;
CREATE POLICY "auth_download_jobs_select" ON download_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_download_jobs_insert" ON download_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_download_jobs_update" ON download_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_download_jobs_delete" ON download_jobs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6. download_queue
DROP POLICY IF EXISTS "auth_download_queue_select" ON download_queue;
CREATE POLICY "auth_download_queue_select" ON download_queue FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 7. email_templates (all operations)
DROP POLICY IF EXISTS "auth_email_templates_all" ON email_templates;
CREATE POLICY "auth_email_templates_select" ON email_templates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_email_templates_insert" ON email_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_email_templates_update" ON email_templates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_email_templates_delete" ON email_templates FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 8. import_logs (all operations)
DROP POLICY IF EXISTS "auth_import_logs_all" ON import_logs;
CREATE POLICY "auth_import_logs_select" ON import_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_import_logs_insert" ON import_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_import_logs_update" ON import_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_import_logs_delete" ON import_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 9. imported_contacts (all operations)
DROP POLICY IF EXISTS "auth_imported_contacts_all" ON imported_contacts;
CREATE POLICY "auth_imported_contacts_select" ON imported_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_imported_contacts_insert" ON imported_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_imported_contacts_update" ON imported_contacts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_imported_contacts_delete" ON imported_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 10. interactions
DROP POLICY IF EXISTS "auth_interactions_select" ON interactions;
CREATE POLICY "auth_interactions_select" ON interactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 11. network_configs
DROP POLICY IF EXISTS "auth_network_configs_select" ON network_configs;
CREATE POLICY "auth_network_configs_select" ON network_configs FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 12. partner_certifications
DROP POLICY IF EXISTS "auth_partner_certifications_select" ON partner_certifications;
CREATE POLICY "auth_partner_certifications_select" ON partner_certifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 13. partner_contacts
DROP POLICY IF EXISTS "auth_partner_contacts_select" ON partner_contacts;
CREATE POLICY "auth_partner_contacts_select" ON partner_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 14. partner_networks
DROP POLICY IF EXISTS "auth_partner_networks_select" ON partner_networks;
CREATE POLICY "auth_partner_networks_select" ON partner_networks FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 15. partner_services
DROP POLICY IF EXISTS "auth_partner_services_select" ON partner_services;
CREATE POLICY "auth_partner_services_select" ON partner_services FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 16. partner_social_links
DROP POLICY IF EXISTS "auth_partner_social_links_select" ON partner_social_links;
CREATE POLICY "auth_partner_social_links_select" ON partner_social_links FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 17. prospect_contacts (all operations)
DROP POLICY IF EXISTS "auth_prospect_contacts_all" ON prospect_contacts;
CREATE POLICY "auth_prospect_contacts_select" ON prospect_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_prospect_contacts_insert" ON prospect_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_prospect_contacts_update" ON prospect_contacts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_prospect_contacts_delete" ON prospect_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 18. prospect_social_links (all operations)
DROP POLICY IF EXISTS "auth_prospect_social_links_all" ON prospect_social_links;
CREATE POLICY "auth_prospect_social_links_select" ON prospect_social_links FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "auth_prospect_social_links_insert" ON prospect_social_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_prospect_social_links_update" ON prospect_social_links FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_prospect_social_links_delete" ON prospect_social_links FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 19. reminders
DROP POLICY IF EXISTS "auth_reminders_select" ON reminders;
CREATE POLICY "auth_reminders_select" ON reminders FOR SELECT TO authenticated USING (user_id = auth.uid());