
-- ============================================
-- STEP 1: Fix partners table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can create their own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can update their own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can delete their own partners" ON public.partners;
DROP POLICY IF EXISTS "partners_select" ON public.partners;
DROP POLICY IF EXISTS "partners_insert" ON public.partners;
DROP POLICY IF EXISTS "partners_update" ON public.partners;
DROP POLICY IF EXISTS "partners_delete" ON public.partners;

CREATE POLICY "partners_select" ON public.partners FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partners_insert" ON public.partners FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "partners_update" ON public.partners FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partners_delete" ON public.partners FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 2: Fix partner_contacts table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own partner contacts" ON public.partner_contacts;
DROP POLICY IF EXISTS "Users can create their own partner contacts" ON public.partner_contacts;
DROP POLICY IF EXISTS "Users can update their own partner contacts" ON public.partner_contacts;
DROP POLICY IF EXISTS "Users can delete their own partner contacts" ON public.partner_contacts;
DROP POLICY IF EXISTS "partner_contacts_select" ON public.partner_contacts;
DROP POLICY IF EXISTS "partner_contacts_insert" ON public.partner_contacts;
DROP POLICY IF EXISTS "partner_contacts_update" ON public.partner_contacts;
DROP POLICY IF EXISTS "partner_contacts_delete" ON public.partner_contacts;

CREATE POLICY "partner_contacts_select" ON public.partner_contacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partner_contacts_insert" ON public.partner_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "partner_contacts_update" ON public.partner_contacts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partner_contacts_delete" ON public.partner_contacts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 3: Fix partner_networks table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own partner networks" ON public.partner_networks;
DROP POLICY IF EXISTS "Users can create their own partner networks" ON public.partner_networks;
DROP POLICY IF EXISTS "Users can update their own partner networks" ON public.partner_networks;
DROP POLICY IF EXISTS "Users can delete their own partner networks" ON public.partner_networks;
DROP POLICY IF EXISTS "partner_networks_select" ON public.partner_networks;
DROP POLICY IF EXISTS "partner_networks_insert" ON public.partner_networks;
DROP POLICY IF EXISTS "partner_networks_update" ON public.partner_networks;
DROP POLICY IF EXISTS "partner_networks_delete" ON public.partner_networks;

CREATE POLICY "partner_networks_select" ON public.partner_networks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partner_networks_insert" ON public.partner_networks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "partner_networks_update" ON public.partner_networks FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partner_networks_delete" ON public.partner_networks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 4: Fix partner_services table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own partner services" ON public.partner_services;
DROP POLICY IF EXISTS "Users can create their own partner services" ON public.partner_services;
DROP POLICY IF EXISTS "Users can update their own partner services" ON public.partner_services;
DROP POLICY IF EXISTS "Users can delete their own partner services" ON public.partner_services;
DROP POLICY IF EXISTS "partner_services_select" ON public.partner_services;
DROP POLICY IF EXISTS "partner_services_insert" ON public.partner_services;
DROP POLICY IF EXISTS "partner_services_update" ON public.partner_services;
DROP POLICY IF EXISTS "partner_services_delete" ON public.partner_services;

CREATE POLICY "partner_services_select" ON public.partner_services FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partner_services_insert" ON public.partner_services FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "partner_services_update" ON public.partner_services FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "partner_services_delete" ON public.partner_services FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 5: Fix activities table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can create activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;
DROP POLICY IF EXISTS "activities_select" ON public.activities;
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
DROP POLICY IF EXISTS "activities_update" ON public.activities;
DROP POLICY IF EXISTS "activities_delete" ON public.activities;

CREATE POLICY "activities_select" ON public.activities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "activities_insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "activities_update" ON public.activities FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "activities_delete" ON public.activities FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 6: Fix interactions table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can create interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can update their own interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can delete their own interactions" ON public.interactions;
DROP POLICY IF EXISTS "interactions_select" ON public.interactions;
DROP POLICY IF EXISTS "interactions_insert" ON public.interactions;
DROP POLICY IF EXISTS "interactions_update" ON public.interactions;
DROP POLICY IF EXISTS "interactions_delete" ON public.interactions;

CREATE POLICY "interactions_select" ON public.interactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "interactions_insert" ON public.interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "interactions_update" ON public.interactions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "interactions_delete" ON public.interactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 7: Fix email_campaign_queue table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own email campaign queue" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "Users can create email campaign queue entries" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "Users can update their own email campaign queue" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "Users can delete their own email campaign queue" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_select" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_insert" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_update" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_delete" ON public.email_campaign_queue;

CREATE POLICY "email_campaign_queue_select" ON public.email_campaign_queue FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "email_campaign_queue_insert" ON public.email_campaign_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "email_campaign_queue_update" ON public.email_campaign_queue FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "email_campaign_queue_delete" ON public.email_campaign_queue FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 8: Fix campaign_jobs table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own campaign jobs" ON public.campaign_jobs;
DROP POLICY IF EXISTS "Users can create campaign jobs" ON public.campaign_jobs;
DROP POLICY IF EXISTS "Users can update their own campaign jobs" ON public.campaign_jobs;
DROP POLICY IF EXISTS "Users can delete their own campaign jobs" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_select" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_insert" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_update" ON public.campaign_jobs;
DROP POLICY IF EXISTS "campaign_jobs_delete" ON public.campaign_jobs;

CREATE POLICY "campaign_jobs_select" ON public.campaign_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "campaign_jobs_insert" ON public.campaign_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaign_jobs_update" ON public.campaign_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "campaign_jobs_delete" ON public.campaign_jobs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 9: Fix directory_cache table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own directory cache" ON public.directory_cache;
DROP POLICY IF EXISTS "Users can create directory cache entries" ON public.directory_cache;
DROP POLICY IF EXISTS "Users can update their own directory cache" ON public.directory_cache;
DROP POLICY IF EXISTS "Users can delete their own directory cache" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_select" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_insert" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_update" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_delete" ON public.directory_cache;

CREATE POLICY "directory_cache_select" ON public.directory_cache FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "directory_cache_insert" ON public.directory_cache FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "directory_cache_update" ON public.directory_cache FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "directory_cache_delete" ON public.directory_cache FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 10: Fix download_jobs table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own download jobs" ON public.download_jobs;
DROP POLICY IF EXISTS "Users can create download jobs" ON public.download_jobs;
DROP POLICY IF EXISTS "Users can update their own download jobs" ON public.download_jobs;
DROP POLICY IF EXISTS "Users can delete their own download jobs" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_select" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_insert" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_update" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_delete" ON public.download_jobs;

CREATE POLICY "download_jobs_select" ON public.download_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "download_jobs_insert" ON public.download_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "download_jobs_update" ON public.download_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "download_jobs_delete" ON public.download_jobs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 11: Fix download_queue table RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view their own download queue" ON public.download_queue;
DROP POLICY IF EXISTS "Users can create download queue entries" ON public.download_queue;
DROP POLICY IF EXISTS "Users can update their own download queue" ON public.download_queue;
DROP POLICY IF EXISTS "Users can delete their own download queue" ON public.download_queue;
DROP POLICY IF EXISTS "download_queue_select" ON public.download_queue;
DROP POLICY IF EXISTS "download_queue_insert" ON public.download_queue;
DROP POLICY IF EXISTS "download_queue_update" ON public.download_queue;
DROP POLICY IF EXISTS "download_queue_delete" ON public.download_queue;

CREATE POLICY "download_queue_select" ON public.download_queue FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "download_queue_insert" ON public.download_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "download_queue_update" ON public.download_queue FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "download_queue_delete" ON public.download_queue FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- STEP 12: Fix operators table - hide sensitive fields
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read operators" ON public.operators;
DROP POLICY IF EXISTS "operators_select" ON public.operators;
DROP POLICY IF EXISTS "operators_insert" ON public.operators;
DROP POLICY IF EXISTS "operators_update" ON public.operators;

-- Operators: own record OR admin can see all
CREATE POLICY "operators_select" ON public.operators FOR SELECT TO authenticated 
  USING (user_id = auth.uid() OR public.is_operator_admin());
CREATE POLICY "operators_update" ON public.operators FOR UPDATE TO authenticated 
  USING (user_id = auth.uid() OR public.is_operator_admin());

-- ============================================
-- STEP 13: Fix storage - workspace-docs bucket
-- ============================================
DROP POLICY IF EXISTS "Workspace docs are publicly readable" ON storage.objects;

CREATE POLICY "workspace_docs_select_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-docs');

-- ============================================
-- STEP 14: Fix storage - import-files bucket
-- ============================================
DROP POLICY IF EXISTS "Public read access for import-files" ON storage.objects;

-- ============================================
-- STEP 15: Fix storage - templates bucket write access
-- ============================================
DROP POLICY IF EXISTS "Anyone can upload templates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update templates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete templates" ON storage.objects;
DROP POLICY IF EXISTS "templates_insert" ON storage.objects;
DROP POLICY IF EXISTS "templates_update" ON storage.objects;
DROP POLICY IF EXISTS "templates_delete" ON storage.objects;

CREATE POLICY "templates_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'templates');
CREATE POLICY "templates_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'templates');
CREATE POLICY "templates_delete_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'templates');
