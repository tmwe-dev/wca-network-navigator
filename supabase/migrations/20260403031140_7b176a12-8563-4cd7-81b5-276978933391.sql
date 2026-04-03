
-- Thread ID for email conversation grouping
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS references_header TEXT;

-- Full-text search vector
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channel_messages_thread_id ON public.channel_messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channel_messages_search_vector ON public.channel_messages USING GIN(search_vector);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.channel_messages_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.from_address, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.body_text, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_channel_messages_search ON public.channel_messages;
CREATE TRIGGER trg_channel_messages_search
  BEFORE INSERT OR UPDATE OF subject, body_text, from_address
  ON public.channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.channel_messages_search_trigger();

-- Backfill existing rows
UPDATE public.channel_messages SET search_vector =
  setweight(to_tsvector('simple', coalesce(subject, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(from_address, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(body_text, '')), 'C')
WHERE search_vector IS NULL;

-- Compute thread_id: use the earliest message_id in the chain
-- Thread = first message_id_external from References header, or in_reply_to, or self
UPDATE public.channel_messages SET thread_id = 
  COALESCE(
    CASE WHEN in_reply_to IS NOT NULL AND in_reply_to != '' THEN in_reply_to END,
    message_id_external
  )
WHERE thread_id IS NULL AND channel = 'email';
