ALTER TABLE public.reply_classifications
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sender_group_id uuid REFERENCES public.email_sender_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS folder_hint text,
  ADD COLUMN IF NOT EXISTS policy_plan jsonb,
  ADD COLUMN IF NOT EXISTS triage jsonb,
  ADD COLUMN IF NOT EXISTS canonical_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_reply_classifications_sender_group_id
  ON public.reply_classifications(sender_group_id);