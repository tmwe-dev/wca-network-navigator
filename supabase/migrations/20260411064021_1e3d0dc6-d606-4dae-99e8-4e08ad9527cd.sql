
-- directory_cache: remove old duplicates (keep dc_* and directory_cache_delete)
DROP POLICY IF EXISTS "user_directory_cache_select" ON public.directory_cache;
DROP POLICY IF EXISTS "user_directory_cache_insert" ON public.directory_cache;
DROP POLICY IF EXISTS "user_directory_cache_update" ON public.directory_cache;
DROP POLICY IF EXISTS "user_directory_cache_delete" ON public.directory_cache;

-- download_jobs: remove old user_* duplicates (keep dj_* and download_jobs_*)
DROP POLICY IF EXISTS "user_download_jobs_select" ON public.download_jobs;
DROP POLICY IF EXISTS "user_download_jobs_insert" ON public.download_jobs;
DROP POLICY IF EXISTS "user_download_jobs_update" ON public.download_jobs;
DROP POLICY IF EXISTS "user_download_jobs_delete" ON public.download_jobs;

-- download_queue: remove old dq_owner_* duplicates (keep download_queue_* and dq_insert)
DROP POLICY IF EXISTS "dq_owner_select" ON public.download_queue;
DROP POLICY IF EXISTS "dq_owner_insert" ON public.download_queue;
DROP POLICY IF EXISTS "dq_owner_update" ON public.download_queue;
DROP POLICY IF EXISTS "dq_owner_delete" ON public.download_queue;

-- email_campaign_queue: remove old duplicates (keep ecq_*)
DROP POLICY IF EXISTS "email_campaign_queue_select" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_insert" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_update" ON public.email_campaign_queue;
DROP POLICY IF EXISTS "email_campaign_queue_delete" ON public.email_campaign_queue;

-- credit_transactions: remove old ct_* duplicates (keep Users can *)
DROP POLICY IF EXISTS "ct_insert" ON public.credit_transactions;
DROP POLICY IF EXISTS "ct_select" ON public.credit_transactions;

-- download_queue: remove extra dq_insert (duplicate of download_queue_insert)
DROP POLICY IF EXISTS "dq_insert" ON public.download_queue;

-- download_queue: remove user_download_queue_select (public role, duplicate)
DROP POLICY IF EXISTS "user_download_queue_select" ON public.download_queue;

-- download_job_items: remove overly permissive auth_* policy
DROP POLICY IF EXISTS "auth_download_job_items_all" ON public.download_job_items;

-- blacklist_sync_log: remove overly permissive auth_* policy  
DROP POLICY IF EXISTS "auth_blacklist_sync_log_all" ON public.blacklist_sync_log;

-- blacklist_entries: remove duplicate bl_select (bl_auth_select already covers)
DROP POLICY IF EXISTS "bl_select" ON public.blacklist_entries;

-- directory_cache: remove duplicate directory_cache_* (dc_* already covers)
DROP POLICY IF EXISTS "directory_cache_select" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_insert" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_update" ON public.directory_cache;
DROP POLICY IF EXISTS "directory_cache_delete" ON public.directory_cache;

-- download_jobs: remove duplicate download_jobs_* (dj_* already covers)
DROP POLICY IF EXISTS "download_jobs_select" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_insert" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_update" ON public.download_jobs;
DROP POLICY IF EXISTS "download_jobs_delete" ON public.download_jobs;

-- ai_plan_templates: remove duplicate policy
DROP POLICY IF EXISTS "apt_all" ON public.ai_plan_templates;
