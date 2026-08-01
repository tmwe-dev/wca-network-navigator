-- Step C: scope email_sync_state per mailbox condivisa.
-- mailbox_id NULL = casella personale (legacy, comportamento invariato).
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.shared_mailboxes(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.email_sync_state.mailbox_id IS
  'Casella aziendale a cui questo cursore IMAP si riferisce. NULL = casella personale dell''operatore (legacy).';

-- Drop vecchia unique su user_id (se presente) e ricrea per (user_id, mailbox_id) con NULL distinti.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_sync_state_user_id_key' AND conrelid = 'public.email_sync_state'::regclass
  ) THEN
    ALTER TABLE public.email_sync_state DROP CONSTRAINT email_sync_state_user_id_key;
  END IF;
END $$;

-- Unique per (user_id, mailbox_id_or_personal). Sfruttiamo expression index.
CREATE UNIQUE INDEX IF NOT EXISTS email_sync_state_user_mailbox_uniq
  ON public.email_sync_state (user_id, COALESCE(mailbox_id, '00000000-0000-0000-0000-000000000000'::uuid));