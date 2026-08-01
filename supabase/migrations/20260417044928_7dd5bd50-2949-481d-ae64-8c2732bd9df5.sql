-- 1a. Folder + hidden_by_rule
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS folder text DEFAULT 'INBOX',
  ADD COLUMN IF NOT EXISTS hidden_by_rule boolean DEFAULT false;

UPDATE public.channel_messages
SET folder = 'INBOX'
WHERE channel = 'email' AND folder IS NULL;

CREATE INDEX IF NOT EXISTS idx_cm_folder
  ON public.channel_messages(operator_id, channel, folder)
  WHERE channel = 'email';

-- 1b. email_address_rules: priority + domain_pattern + address + last_applied_at + applied_count
ALTER TABLE public.email_address_rules
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS domain_pattern text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS last_applied_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS applied_count integer DEFAULT 0;

-- Backfill address da email_address
UPDATE public.email_address_rules
SET address = email_address
WHERE address IS NULL;

-- Backfill domain_pattern da domain
UPDATE public.email_address_rules
SET domain_pattern = domain
WHERE domain_pattern IS NULL AND domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ear_address
  ON public.email_address_rules(operator_id, address)
  WHERE address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ear_domain_pattern
  ON public.email_address_rules(operator_id, domain_pattern)
  WHERE domain_pattern IS NOT NULL;

-- 1c. RLS su email_address_rules (CAT-B per operatore)
ALTER TABLE public.email_address_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ear_select_own ON public.email_address_rules;
DROP POLICY IF EXISTS ear_insert_own ON public.email_address_rules;
DROP POLICY IF EXISTS ear_update_own ON public.email_address_rules;
DROP POLICY IF EXISTS ear_delete_own ON public.email_address_rules;

CREATE POLICY ear_select_own ON public.email_address_rules FOR SELECT TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY ear_insert_own ON public.email_address_rules FOR INSERT TO authenticated
  WITH CHECK (operator_id IS NOT NULL AND operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY ear_update_own ON public.email_address_rules FOR UPDATE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()))
  WITH CHECK (operator_id = ANY(public.get_effective_operator_ids()));
CREATE POLICY ear_delete_own ON public.email_address_rules FOR DELETE TO authenticated
  USING (operator_id = ANY(public.get_effective_operator_ids()));

-- 1d. RLS su email_sender_groups (CAT-A condivisi)
ALTER TABLE public.email_sender_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS esg_select_shared ON public.email_sender_groups;
DROP POLICY IF EXISTS esg_insert_shared ON public.email_sender_groups;
DROP POLICY IF EXISTS esg_update_shared ON public.email_sender_groups;
DROP POLICY IF EXISTS esg_delete_shared ON public.email_sender_groups;

CREATE POLICY esg_select_shared ON public.email_sender_groups FOR SELECT TO authenticated
  USING (true);
CREATE POLICY esg_insert_shared ON public.email_sender_groups FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY esg_update_shared ON public.email_sender_groups FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY esg_delete_shared ON public.email_sender_groups FOR DELETE TO authenticated
  USING (true);