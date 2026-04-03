-- New columns on channel_messages for RFC-compliant raw storage & server metadata
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS raw_storage_path text;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS raw_sha256 text;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS raw_size_bytes integer;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS imap_uid integer;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS uidvalidity integer;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS imap_flags text;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS internal_date timestamptz;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS parse_status text DEFAULT 'ok';
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS parse_warnings text[];

-- Add content_id and is_inline to email_attachments for cid: inline images
ALTER TABLE public.email_attachments ADD COLUMN IF NOT EXISTS content_id text;
ALTER TABLE public.email_attachments ADD COLUMN IF NOT EXISTS is_inline boolean DEFAULT false;

-- Index for faster deduplica by raw hash
CREATE INDEX IF NOT EXISTS idx_channel_messages_raw_sha256 ON public.channel_messages (raw_sha256) WHERE raw_sha256 IS NOT NULL;

-- Index for IMAP UID lookups during sync
CREATE INDEX IF NOT EXISTS idx_channel_messages_imap_uid ON public.channel_messages (user_id, imap_uid) WHERE imap_uid IS NOT NULL;