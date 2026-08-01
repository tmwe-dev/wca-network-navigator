-- FIX CRITICAL: Make import-files bucket private (contains PII)
UPDATE storage.buckets SET public = false WHERE id = 'import-files';

-- FIX CRITICAL: Make chat-attachments bucket private 
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- Add proper user-scoped storage policies for chat-attachments
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;

CREATE POLICY "Users can view own chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own chat attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add user-scoped storage policies for import-files
CREATE POLICY "Users can view own import files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'import-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload import files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'import-files' AND auth.uid()::text = (storage.foldername(name))[1]);