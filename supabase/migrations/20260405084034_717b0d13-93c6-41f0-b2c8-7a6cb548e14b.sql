
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Encrypt WCA passwords
ALTER TABLE public.user_wca_credentials ADD COLUMN wca_password_encrypted bytea;

UPDATE public.user_wca_credentials
SET wca_password_encrypted = extensions.pgp_sym_encrypt(
  wca_password,
  current_setting('app.settings.service_role_key', true)
);

ALTER TABLE public.user_wca_credentials DROP COLUMN wca_password;
ALTER TABLE public.user_wca_credentials RENAME COLUMN wca_password_encrypted TO wca_password;

-- Helper functions
CREATE OR REPLACE FUNCTION public.encrypt_wca_password(p_password text)
RETURNS bytea
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_encrypt(p_password, current_setting('app.settings.service_role_key', true));
$$;

CREATE OR REPLACE FUNCTION public.decrypt_wca_password(p_encrypted bytea)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(p_encrypted, current_setting('app.settings.service_role_key', true));
$$;

-- Storage: drop ALL existing policies on objects for our buckets
DROP POLICY IF EXISTS "templates_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "templates_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "templates_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "templates_delete_auth" ON storage.objects;
DROP POLICY IF EXISTS "Templates are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "workspace_docs_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload workspace docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete workspace docs" ON storage.objects;
DROP POLICY IF EXISTS "auth_import_files_select" ON storage.objects;
DROP POLICY IF EXISTS "auth_import_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "auth_import_files_delete" ON storage.objects;

-- Templates: authenticated only
CREATE POLICY "tpl_select_v2" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'templates');
CREATE POLICY "tpl_insert_v2" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'templates');
CREATE POLICY "tpl_update_v2" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'templates');
CREATE POLICY "tpl_delete_v2" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'templates');

-- workspace-docs: user-scoped
CREATE POLICY "wdocs_select_v2" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'workspace-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wdocs_insert_v2" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'workspace-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wdocs_update_v2" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'workspace-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wdocs_delete_v2" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'workspace-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- import-files: user-scoped
CREATE POLICY "imp_select_v2" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'import-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "imp_insert_v2" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'import-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "imp_update_v2" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'import-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "imp_delete_v2" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'import-files' AND auth.uid()::text = (storage.foldername(name))[1]);
