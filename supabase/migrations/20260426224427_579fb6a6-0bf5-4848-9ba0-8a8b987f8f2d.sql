ALTER TABLE public.email_address_rules
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_address_rules_is_blocked
  ON public.email_address_rules (is_blocked) WHERE is_blocked = true;