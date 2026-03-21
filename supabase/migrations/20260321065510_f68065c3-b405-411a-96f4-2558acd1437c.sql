
-- Add user_id to remaining tables for multi-tenant isolation

ALTER TABLE public.partner_contacts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.partner_networks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.partner_services ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.partner_certifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.import_logs ADD COLUMN IF NOT EXISTS user_id uuid; -- already has user_id but ensure
ALTER TABLE public.campaign_jobs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.download_queue ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.email_campaign_queue ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.imported_contacts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- partner_contacts RLS
DROP POLICY IF EXISTS "auth_partner_contacts_select" ON public.partner_contacts;
DROP POLICY IF EXISTS "auth_partner_contacts_insert" ON public.partner_contacts;
DROP POLICY IF EXISTS "auth_partner_contacts_update" ON public.partner_contacts;
DROP POLICY IF EXISTS "auth_partner_contacts_delete" ON public.partner_contacts;
CREATE POLICY "user_partner_contacts_select" ON public.partner_contacts FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_contacts_insert" ON public.partner_contacts FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_contacts_update" ON public.partner_contacts FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_contacts_delete" ON public.partner_contacts FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- partner_networks RLS
DROP POLICY IF EXISTS "auth_partner_networks_select" ON public.partner_networks;
DROP POLICY IF EXISTS "auth_partner_networks_insert" ON public.partner_networks;
DROP POLICY IF EXISTS "auth_partner_networks_update" ON public.partner_networks;
DROP POLICY IF EXISTS "auth_partner_networks_delete" ON public.partner_networks;
CREATE POLICY "user_partner_networks_select" ON public.partner_networks FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_networks_insert" ON public.partner_networks FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_networks_update" ON public.partner_networks FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_networks_delete" ON public.partner_networks FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- partner_services RLS
DROP POLICY IF EXISTS "auth_partner_services_select" ON public.partner_services;
DROP POLICY IF EXISTS "auth_partner_services_insert" ON public.partner_services;
DROP POLICY IF EXISTS "auth_partner_services_update" ON public.partner_services;
DROP POLICY IF EXISTS "auth_partner_services_delete" ON public.partner_services;
CREATE POLICY "user_partner_services_select" ON public.partner_services FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_services_insert" ON public.partner_services FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_services_update" ON public.partner_services FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partner_services_delete" ON public.partner_services FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- campaign_jobs RLS
DROP POLICY IF EXISTS "auth_campaign_jobs_select" ON public.campaign_jobs;
DROP POLICY IF EXISTS "auth_campaign_jobs_insert" ON public.campaign_jobs;
DROP POLICY IF EXISTS "auth_campaign_jobs_update" ON public.campaign_jobs;
DROP POLICY IF EXISTS "auth_campaign_jobs_delete" ON public.campaign_jobs;
CREATE POLICY "user_campaign_jobs_select" ON public.campaign_jobs FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_campaign_jobs_insert" ON public.campaign_jobs FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_campaign_jobs_update" ON public.campaign_jobs FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_campaign_jobs_delete" ON public.campaign_jobs FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- interactions RLS
DROP POLICY IF EXISTS "auth_interactions_select" ON public.interactions;
DROP POLICY IF EXISTS "auth_interactions_insert" ON public.interactions;
DROP POLICY IF EXISTS "auth_interactions_update" ON public.interactions;
DROP POLICY IF EXISTS "auth_interactions_delete" ON public.interactions;
CREATE POLICY "user_interactions_select" ON public.interactions FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_interactions_insert" ON public.interactions FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_interactions_update" ON public.interactions FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_interactions_delete" ON public.interactions FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- download_queue RLS
DROP POLICY IF EXISTS "auth_download_queue_select" ON public.download_queue;
DROP POLICY IF EXISTS "auth_download_queue_insert" ON public.download_queue;
DROP POLICY IF EXISTS "auth_download_queue_update" ON public.download_queue;
DROP POLICY IF EXISTS "auth_download_queue_delete" ON public.download_queue;
CREATE POLICY "user_download_queue_select" ON public.download_queue FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_download_queue_insert" ON public.download_queue FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_download_queue_update" ON public.download_queue FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_download_queue_delete" ON public.download_queue FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- email_campaign_queue RLS
DROP POLICY IF EXISTS "auth_email_campaign_queue_all" ON public.email_campaign_queue;
CREATE POLICY "user_email_campaign_queue_select" ON public.email_campaign_queue FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_email_campaign_queue_insert" ON public.email_campaign_queue FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_email_campaign_queue_update" ON public.email_campaign_queue FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_email_campaign_queue_delete" ON public.email_campaign_queue FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- imported_contacts RLS (keep existing import_log_id based access but add user_id)
ALTER TABLE public.imported_contacts DROP CONSTRAINT IF EXISTS imported_contacts_user_id_fkey;
