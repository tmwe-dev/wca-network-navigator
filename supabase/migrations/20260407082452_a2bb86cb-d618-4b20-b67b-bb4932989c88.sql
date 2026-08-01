
-- Create email-images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('email-images', 'email-images', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload email images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-images');

-- Allow public read (emails need to render images)
CREATE POLICY "Anyone can view email images"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-images');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete email images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-images');
