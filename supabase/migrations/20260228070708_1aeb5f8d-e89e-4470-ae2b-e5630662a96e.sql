
-- 1. Create import_logs table
CREATE TABLE public.import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text,
  file_size integer NOT NULL DEFAULT 0,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  normalization_method text NOT NULL DEFAULT 'ai',
  processing_batch integer NOT NULL DEFAULT 0,
  total_batches integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- 2. Create imported_contacts table (staging)
CREATE TABLE public.imported_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_log_id uuid NOT NULL REFERENCES public.import_logs(id) ON DELETE CASCADE,
  row_number integer NOT NULL DEFAULT 0,
  company_name text,
  name text,
  email text,
  phone text,
  mobile text,
  country text,
  city text,
  address text,
  zip_code text,
  note text,
  origin text,
  company_alias text,
  contact_alias text,
  is_selected boolean NOT NULL DEFAULT false,
  is_transferred boolean NOT NULL DEFAULT false,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Create import_errors table
CREATE TABLE public.import_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_log_id uuid NOT NULL REFERENCES public.import_logs(id) ON DELETE CASCADE,
  row_number integer NOT NULL DEFAULT 0,
  error_type text NOT NULL DEFAULT 'validation',
  error_message text,
  raw_data jsonb,
  corrected_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempted_corrections integer NOT NULL DEFAULT 0,
  ai_suggestions jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. RLS policies
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_import_logs_all" ON public.import_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_imported_contacts_all" ON public.imported_contacts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_import_errors_all" ON public.import_errors FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Storage bucket for import files
INSERT INTO storage.buckets (id, name, public) VALUES ('import-files', 'import-files', true);

-- 6. Storage RLS policies
CREATE POLICY "auth_import_files_select" ON storage.objects FOR SELECT USING (bucket_id = 'import-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth_import_files_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'import-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth_import_files_delete" ON storage.objects FOR DELETE USING (bucket_id = 'import-files' AND auth.uid() IS NOT NULL);

-- 7. Indexes
CREATE INDEX idx_imported_contacts_log ON public.imported_contacts(import_log_id);
CREATE INDEX idx_import_errors_log ON public.import_errors(import_log_id);
CREATE INDEX idx_import_logs_user ON public.import_logs(user_id);
CREATE INDEX idx_import_logs_status ON public.import_logs(status);
