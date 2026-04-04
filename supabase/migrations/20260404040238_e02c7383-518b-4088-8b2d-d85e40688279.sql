
-- =============================================
-- FASE 2: Rimozione policy duplicate permissive
-- =============================================

-- PARTNERS: rimuovi le policy public che permettono user_id IS NULL
DROP POLICY IF EXISTS "user_partners_select" ON public.partners;
DROP POLICY IF EXISTS "user_partners_insert" ON public.partners;
DROP POLICY IF EXISTS "user_partners_update" ON public.partners;
DROP POLICY IF EXISTS "user_partners_delete" ON public.partners;

-- PARTNER_CONTACTS: rimuovi le policy public duplicate
DROP POLICY IF EXISTS "user_partner_contacts_select" ON public.partner_contacts;
DROP POLICY IF EXISTS "user_partner_contacts_insert" ON public.partner_contacts;
DROP POLICY IF EXISTS "user_partner_contacts_update" ON public.partner_contacts;
DROP POLICY IF EXISTS "user_partner_contacts_delete" ON public.partner_contacts;

-- PARTNER_NETWORKS: rimuovi le policy public duplicate
DROP POLICY IF EXISTS "user_partner_networks_select" ON public.partner_networks;
DROP POLICY IF EXISTS "user_partner_networks_insert" ON public.partner_networks;
DROP POLICY IF EXISTS "user_partner_networks_update" ON public.partner_networks;
DROP POLICY IF EXISTS "user_partner_networks_delete" ON public.partner_networks;

-- PARTNER_SERVICES: rimuovi le policy public duplicate
DROP POLICY IF EXISTS "user_partner_services_select" ON public.partner_services;
DROP POLICY IF EXISTS "user_partner_services_insert" ON public.partner_services;
DROP POLICY IF EXISTS "user_partner_services_update" ON public.partner_services;
DROP POLICY IF EXISTS "user_partner_services_delete" ON public.partner_services;

-- CAMPAIGN_JOBS: rimuovi le policy public duplicate
DROP POLICY IF EXISTS "user_campaign_jobs_select" ON public.campaign_jobs;
DROP POLICY IF EXISTS "user_campaign_jobs_insert" ON public.campaign_jobs;
DROP POLICY IF EXISTS "user_campaign_jobs_update" ON public.campaign_jobs;
DROP POLICY IF EXISTS "user_campaign_jobs_delete" ON public.campaign_jobs;

-- ACTIVITIES: rimuovi le policy public duplicate
DROP POLICY IF EXISTS "user_activities_select" ON public.activities;
DROP POLICY IF EXISTS "user_activities_insert" ON public.activities;
DROP POLICY IF EXISTS "user_activities_update" ON public.activities;
DROP POLICY IF EXISTS "user_activities_delete" ON public.activities;

-- =============================================
-- FASE 3: Fix tabelle senza user_id scoping
-- =============================================

-- REMINDERS: manca user_id, aggiungiamolo
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS user_id uuid;

-- Drop vecchie policy permissive
DROP POLICY IF EXISTS "auth_reminders_select" ON public.reminders;
DROP POLICY IF EXISTS "auth_reminders_insert" ON public.reminders;
DROP POLICY IF EXISTS "auth_reminders_update" ON public.reminders;
DROP POLICY IF EXISTS "auth_reminders_delete" ON public.reminders;

CREATE POLICY "reminders_select" ON public.reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "reminders_insert" ON public.reminders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reminders_update" ON public.reminders FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "reminders_delete" ON public.reminders FOR DELETE TO authenticated USING (user_id = auth.uid());

-- PARTNER_SOCIAL_LINKS: sostituisci auth.uid() IS NOT NULL con user_id scoping
ALTER TABLE public.partner_social_links ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "auth_partner_social_links_select" ON public.partner_social_links;
DROP POLICY IF EXISTS "auth_partner_social_links_insert" ON public.partner_social_links;
DROP POLICY IF EXISTS "auth_partner_social_links_update" ON public.partner_social_links;
DROP POLICY IF EXISTS "auth_partner_social_links_delete" ON public.partner_social_links;

CREATE POLICY "social_links_select" ON public.partner_social_links FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social_links_insert" ON public.partner_social_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "social_links_update" ON public.partner_social_links FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social_links_delete" ON public.partner_social_links FOR DELETE TO authenticated USING (user_id = auth.uid());

-- WORKSPACE_DOCUMENTS: aggiungi user_id
ALTER TABLE public.workspace_documents ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "auth_workspace_documents_all" ON public.workspace_documents;

CREATE POLICY "workspace_docs_select" ON public.workspace_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "workspace_docs_insert" ON public.workspace_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "workspace_docs_update" ON public.workspace_documents FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "workspace_docs_delete" ON public.workspace_documents FOR DELETE TO authenticated USING (user_id = auth.uid());

-- DOWNLOAD_JOB_EVENTS: link tramite job, non user_id diretto
DROP POLICY IF EXISTS "auth_download_job_events_all" ON public.download_job_events;

CREATE POLICY "dje_select" ON public.download_job_events FOR SELECT TO authenticated 
  USING (job_id IN (SELECT id FROM public.download_jobs WHERE user_id = auth.uid()));
CREATE POLICY "dje_insert" ON public.download_job_events FOR INSERT TO authenticated 
  WITH CHECK (job_id IN (SELECT id FROM public.download_jobs WHERE user_id = auth.uid()));

-- PROSPECT_INTERACTIONS: link tramite prospect
DROP POLICY IF EXISTS "auth_prospect_interactions_all" ON public.prospect_interactions;

CREATE POLICY "pi_all" ON public.prospect_interactions FOR ALL TO authenticated 
  USING (prospect_id IN (SELECT id FROM public.prospects WHERE TRUE))
  WITH CHECK (prospect_id IN (SELECT id FROM public.prospects WHERE TRUE));

-- CONTACT_INTERACTIONS: link tramite contact
DROP POLICY IF EXISTS "auth_contact_interactions_all" ON public.contact_interactions;

CREATE POLICY "ci_all" ON public.contact_interactions FOR ALL TO authenticated 
  USING (contact_id IN (SELECT id FROM public.imported_contacts WHERE user_id = auth.uid()))
  WITH CHECK (contact_id IN (SELECT id FROM public.imported_contacts WHERE user_id = auth.uid()));

-- PROSPECT_CONTACTS: link tramite prospect
DROP POLICY IF EXISTS "auth_prospect_contacts_all" ON public.prospect_contacts;

CREATE POLICY "pc_all" ON public.prospect_contacts FOR ALL TO authenticated 
  USING (prospect_id IN (SELECT id FROM public.prospects WHERE TRUE))
  WITH CHECK (prospect_id IN (SELECT id FROM public.prospects WHERE TRUE));

-- EMAIL_TEMPLATES: condivise, solo autenticati
DROP POLICY IF EXISTS "auth_email_templates_all" ON public.email_templates;

CREATE POLICY "et_select" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "et_insert" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "et_update" ON public.email_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "et_delete" ON public.email_templates FOR DELETE TO authenticated USING (true);

-- NETWORK_CONFIGS: condivise, solo autenticati (config di sistema)
DROP POLICY IF EXISTS "auth_network_configs_select" ON public.network_configs;
DROP POLICY IF EXISTS "auth_network_configs_insert" ON public.network_configs;
DROP POLICY IF EXISTS "auth_network_configs_update" ON public.network_configs;
DROP POLICY IF EXISTS "auth_network_configs_delete" ON public.network_configs;

CREATE POLICY "nc_select" ON public.network_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "nc_insert" ON public.network_configs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nc_update" ON public.network_configs FOR UPDATE TO authenticated USING (true);

-- APP_SETTINGS: condivise, solo autenticati
DROP POLICY IF EXISTS "auth_app_settings_all" ON public.app_settings;

CREATE POLICY "as_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "as_insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "as_update" ON public.app_settings FOR UPDATE TO authenticated USING (true);

-- =============================================
-- FASE 4: Abilita RLS su tabelle senza protezione
-- =============================================

-- BLACKLIST_ENTRIES
ALTER TABLE public.blacklist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bl_select" ON public.blacklist_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "bl_insert" ON public.blacklist_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bl_update" ON public.blacklist_entries FOR UPDATE TO authenticated USING (true);

-- BLACKLIST_SYNC_LOG
ALTER TABLE public.blacklist_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsl_select" ON public.blacklist_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "bsl_insert" ON public.blacklist_sync_log FOR INSERT TO authenticated WITH CHECK (true);

-- PARTNER_CERTIFICATIONS
ALTER TABLE public.partner_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_select" ON public.partner_certifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cert_insert" ON public.partner_certifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cert_update" ON public.partner_certifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cert_delete" ON public.partner_certifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- IMPORT_LOGS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "il_select" ON public.import_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "il_insert" ON public.import_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "il_update" ON public.import_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- IMPORTED_CONTACTS
ALTER TABLE public.imported_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_select" ON public.imported_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ic_insert" ON public.imported_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ic_update" ON public.imported_contacts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ic_delete" ON public.imported_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- IMPORT_ERRORS: link tramite import_log
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ie_select" ON public.import_errors FOR SELECT TO authenticated 
  USING (import_log_id IN (SELECT id FROM public.import_logs WHERE user_id = auth.uid()));
CREATE POLICY "ie_insert" ON public.import_errors FOR INSERT TO authenticated 
  WITH CHECK (import_log_id IN (SELECT id FROM public.import_logs WHERE user_id = auth.uid()));

-- PROSPECTS: manca user_id, serve aggiungerlo o usare auth check base
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospects_select" ON public.prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY "prospects_insert" ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prospects_update" ON public.prospects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "prospects_delete" ON public.prospects FOR DELETE TO authenticated USING (true);

-- PROSPECT_SOCIAL_LINKS
ALTER TABLE public.prospect_social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psl_all" ON public.prospect_social_links FOR ALL TO authenticated 
  USING (prospect_id IN (SELECT id FROM public.prospects WHERE TRUE))
  WITH CHECK (prospect_id IN (SELECT id FROM public.prospects WHERE TRUE));

-- PARTNERS_NO_CONTACTS
ALTER TABLE public.partners_no_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pnc_select" ON public.partners_no_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "pnc_insert" ON public.partners_no_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pnc_update" ON public.partners_no_contacts FOR UPDATE TO authenticated USING (true);

-- CREDIT_TRANSACTIONS: user-scoped
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_select" ON public.credit_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ct_insert" ON public.credit_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- DIRECTORY_CACHE
ALTER TABLE public.directory_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc_select" ON public.directory_cache FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "dc_insert" ON public.directory_cache FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "dc_update" ON public.directory_cache FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- DOWNLOAD_QUEUE
ALTER TABLE public.download_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dq_select" ON public.download_queue FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "dq_insert" ON public.download_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "dq_update" ON public.download_queue FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- DOWNLOAD_JOBS
ALTER TABLE public.download_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dj_select" ON public.download_jobs FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "dj_insert" ON public.download_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "dj_update" ON public.download_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- DOWNLOAD_JOB_ITEMS: link tramite job
ALTER TABLE public.download_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dji_select" ON public.download_job_items FOR SELECT TO authenticated 
  USING (job_id IN (SELECT id FROM public.download_jobs WHERE user_id = auth.uid() OR user_id IS NULL));
CREATE POLICY "dji_insert" ON public.download_job_items FOR INSERT TO authenticated 
  WITH CHECK (job_id IN (SELECT id FROM public.download_jobs WHERE user_id = auth.uid()));

-- EMAIL_DRAFTS
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ed_all" ON public.email_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- EMAIL_CAMPAIGN_QUEUE
ALTER TABLE public.email_campaign_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecq_select" ON public.email_campaign_queue FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "ecq_insert" ON public.email_campaign_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ecq_update" ON public.email_campaign_queue FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- EMAIL_SYNC_JOBS
ALTER TABLE public.email_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esj_all" ON public.email_sync_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INTERACTIONS
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "int_select" ON public.interactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "int_insert" ON public.interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "int_update" ON public.interactions FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "int_delete" ON public.interactions FOR DELETE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- LINKEDIN_FLOW_JOBS
ALTER TABLE public.linkedin_flow_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lfj_all" ON public.linkedin_flow_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI_PLAN_TEMPLATES
ALTER TABLE public.ai_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apt_all" ON public.ai_plan_templates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TEAM_MEMBERS (se esiste)
-- Lo saltiamo, verrà gestito in un passaggio separato se necessario
