
INSERT INTO storage.buckets (id, name, public)
VALUES ('cockpit-attachments', 'cockpit-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own cockpit attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cockpit-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own cockpit attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cockpit-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own cockpit attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cockpit-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
