-- Unique index for deduplication: user_id + message_id_external
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_messages_user_msgid 
ON public.channel_messages (user_id, message_id_external) 
WHERE message_id_external IS NOT NULL;

-- Add stored_uidvalidity to email_sync_state for UIDVALIDITY change detection
ALTER TABLE public.email_sync_state ADD COLUMN IF NOT EXISTS stored_uidvalidity integer;