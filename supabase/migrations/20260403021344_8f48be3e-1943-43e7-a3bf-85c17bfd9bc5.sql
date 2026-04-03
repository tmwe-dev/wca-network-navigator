
-- CC/BCC columns
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS cc_addresses text;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS bcc_addresses text;

-- Dedup index on email_attachments
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_attachments_dedup 
ON public.email_attachments (message_id, filename);
