
-- Enums for campaign jobs
CREATE TYPE public.campaign_job_type AS ENUM ('email', 'call');
CREATE TYPE public.campaign_job_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

-- Table
CREATE TABLE public.campaign_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  country_name TEXT NOT NULL,
  city TEXT,
  email TEXT,
  phone TEXT,
  job_type public.campaign_job_type NOT NULL DEFAULT 'email',
  status public.campaign_job_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES public.team_members(id),
  notes TEXT,
  batch_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- RLS
ALTER TABLE public.campaign_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_campaign_jobs_select" ON public.campaign_jobs FOR SELECT USING (true);
CREATE POLICY "public_campaign_jobs_insert" ON public.campaign_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_campaign_jobs_update" ON public.campaign_jobs FOR UPDATE USING (true);
CREATE POLICY "public_campaign_jobs_delete" ON public.campaign_jobs FOR DELETE USING (true);

-- Indexes
CREATE INDEX idx_campaign_jobs_batch ON public.campaign_jobs(batch_id);
CREATE INDEX idx_campaign_jobs_status ON public.campaign_jobs(status);
CREATE INDEX idx_campaign_jobs_partner ON public.campaign_jobs(partner_id);
