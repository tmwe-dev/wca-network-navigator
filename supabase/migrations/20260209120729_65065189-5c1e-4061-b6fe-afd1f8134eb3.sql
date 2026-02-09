ALTER TABLE public.download_jobs 
  ADD COLUMN contacts_found_count integer NOT NULL DEFAULT 0,
  ADD COLUMN contacts_missing_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_contact_result text;