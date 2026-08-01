-- P2.1: Composite indexes on hot WHERE/JOIN columns
CREATE INDEX IF NOT EXISTS idx_partners_country_lead_status
  ON public.partners(country_code, lead_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_user_id
  ON public.imported_contacts(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_download_jobs_status_user
  ON public.download_jobs(status, user_id);

CREATE INDEX IF NOT EXISTS idx_activities_partner_status
  ON public.activities(partner_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaign_queue_status_scheduled
  ON public.email_campaign_queue(status, scheduled_at);

-- P2.2: Enforced FK to auth.users on critical tables (ON DELETE CASCADE)
ALTER TABLE public.agent_tasks
  ADD CONSTRAINT agent_tasks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.agent_tasks VALIDATE CONSTRAINT agent_tasks_user_id_fkey;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.ai_conversations VALIDATE CONSTRAINT ai_conversations_user_id_fkey;

ALTER TABLE public.ai_memory
  ADD CONSTRAINT ai_memory_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.ai_memory VALIDATE CONSTRAINT ai_memory_user_id_fkey;

ALTER TABLE public.import_logs
  ADD CONSTRAINT import_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.import_logs VALIDATE CONSTRAINT import_logs_user_id_fkey;