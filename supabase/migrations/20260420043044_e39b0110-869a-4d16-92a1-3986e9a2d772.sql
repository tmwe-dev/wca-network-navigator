-- EVO-0A #1bis: separa email_status (fatto tecnico) da lead_status (decisione commerciale)
ALTER TABLE public.imported_contacts 
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'valid'
  CHECK (email_status IN ('valid', 'bounced', 'invalid'));

ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'valid'
  CHECK (email_status IN ('valid', 'bounced', 'invalid'));

CREATE INDEX IF NOT EXISTS idx_imported_contacts_email_status 
  ON public.imported_contacts(email_status) WHERE email_status != 'valid';

CREATE INDEX IF NOT EXISTS idx_partners_email_status 
  ON public.partners(email_status) WHERE email_status != 'valid';