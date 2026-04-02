DROP INDEX IF EXISTS idx_channel_messages_external_id;
CREATE UNIQUE INDEX idx_channel_messages_external_id ON public.channel_messages (message_id_external) WHERE message_id_external IS NOT NULL;