-- Drop the partial unique index that PostgREST cannot use for ON CONFLICT
DROP INDEX IF EXISTS idx_channel_messages_user_msgid;

-- Create a proper UNIQUE constraint (NULLs are always distinct in PG, so multiple NULL message_id_external are allowed)
ALTER TABLE public.channel_messages
  ADD CONSTRAINT uq_channel_messages_user_msgid UNIQUE (user_id, message_id_external);