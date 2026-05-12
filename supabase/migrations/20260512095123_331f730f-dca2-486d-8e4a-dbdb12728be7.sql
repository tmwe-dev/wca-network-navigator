-- Step A: collega channel_messages alla casella di posta di provenienza.
-- NULL = casella personale dell'operatore (comportamento legacy preservato).
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.shared_mailboxes(id) ON DELETE SET NULL;

-- Index parziale: filtriamo solo quando mailbox_id è valorizzato (caselle condivise).
CREATE INDEX IF NOT EXISTS idx_channel_messages_mailbox_id
  ON public.channel_messages (mailbox_id, email_date DESC NULLS LAST)
  WHERE mailbox_id IS NOT NULL;

COMMENT ON COLUMN public.channel_messages.mailbox_id IS
  'Casella di posta condivisa di origine. NULL = casella personale dell''operatore (user_id). Popolata da check-inbox quando il poller scarica da una shared_mailbox.';