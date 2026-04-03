
-- Add email_date column to store original email date
ALTER TABLE public.channel_messages
ADD COLUMN IF NOT EXISTS email_date timestamp with time zone;

-- Add UNIQUE index on message_id_external for proper upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_message_id_external
ON public.channel_messages (message_id_external)
WHERE message_id_external IS NOT NULL;

-- Make import-files bucket public
UPDATE storage.buckets SET public = true WHERE id = 'import-files';

-- Add public read policy for import-files bucket
CREATE POLICY "Public read access for import-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'import-files');
