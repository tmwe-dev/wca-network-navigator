-- Remove the global UNIQUE constraint (wrong: blocks same message_id across users)
ALTER TABLE public.channel_messages DROP CONSTRAINT IF EXISTS channel_messages_message_id_external_key;

-- Remove redundant partial UNIQUE index (duplicates the per-user one)
DROP INDEX IF EXISTS idx_channel_messages_message_id_external;

-- Keep only idx_channel_messages_user_msgid which is correct (per-user dedup)