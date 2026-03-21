
-- Add user_id to partners table for multi-tenant isolation
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id to download_jobs table  
ALTER TABLE public.download_jobs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id to activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add user_id to directory_cache table
ALTER TABLE public.directory_cache ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update RLS policies for partners
DROP POLICY IF EXISTS "auth_partners_select" ON public.partners;
DROP POLICY IF EXISTS "auth_partners_insert" ON public.partners;
DROP POLICY IF EXISTS "auth_partners_update" ON public.partners;
DROP POLICY IF EXISTS "auth_partners_delete" ON public.partners;

CREATE POLICY "user_partners_select" ON public.partners FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partners_insert" ON public.partners FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partners_update" ON public.partners FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_partners_delete" ON public.partners FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- Update RLS policies for download_jobs
DROP POLICY IF EXISTS "auth_download_jobs_all" ON public.download_jobs;

CREATE POLICY "user_download_jobs_select" ON public.download_jobs FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_download_jobs_insert" ON public.download_jobs FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_download_jobs_update" ON public.download_jobs FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_download_jobs_delete" ON public.download_jobs FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- Update RLS policies for activities
DROP POLICY IF EXISTS "auth_activities_select" ON public.activities;
DROP POLICY IF EXISTS "auth_activities_insert" ON public.activities;
DROP POLICY IF EXISTS "auth_activities_update" ON public.activities;
DROP POLICY IF EXISTS "auth_activities_delete" ON public.activities;

CREATE POLICY "user_activities_select" ON public.activities FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_activities_insert" ON public.activities FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_activities_update" ON public.activities FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_activities_delete" ON public.activities FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- Update RLS policies for directory_cache
DROP POLICY IF EXISTS "auth_directory_cache_all" ON public.directory_cache;

CREATE POLICY "user_directory_cache_select" ON public.directory_cache FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_directory_cache_insert" ON public.directory_cache FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_directory_cache_update" ON public.directory_cache FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_directory_cache_delete" ON public.directory_cache FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);
