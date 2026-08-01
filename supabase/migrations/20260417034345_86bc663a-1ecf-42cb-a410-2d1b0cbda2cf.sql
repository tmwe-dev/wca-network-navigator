-- ============================================================
-- SOFT DELETE: aggiungi deleted_at + deleted_by a tabelle business
-- ============================================================

-- Macro helper inline (ripetuto per ogni tabella)

-- partners
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_partners_not_deleted
  ON public.partners (created_at DESC) WHERE deleted_at IS NULL;

-- partner_contacts
ALTER TABLE public.partner_contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_partner_contacts_not_deleted
  ON public.partner_contacts (created_at DESC) WHERE deleted_at IS NULL;

-- business_cards
ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_business_cards_not_deleted
  ON public.business_cards (created_at DESC) WHERE deleted_at IS NULL;

-- activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_activities_not_deleted
  ON public.activities (created_at DESC) WHERE deleted_at IS NULL;

-- reminders
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_reminders_not_deleted
  ON public.reminders (created_at DESC) WHERE deleted_at IS NULL;

-- agents
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_agents_not_deleted
  ON public.agents (created_at DESC) WHERE deleted_at IS NULL;

-- outreach_missions
ALTER TABLE public.outreach_missions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_outreach_missions_not_deleted
  ON public.outreach_missions (created_at DESC) WHERE deleted_at IS NULL;

-- outreach_queue
ALTER TABLE public.outreach_queue
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_outreach_queue_not_deleted
  ON public.outreach_queue (created_at DESC) WHERE deleted_at IS NULL;

-- mission_actions
ALTER TABLE public.mission_actions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_mission_actions_not_deleted
  ON public.mission_actions (created_at DESC) WHERE deleted_at IS NULL;

-- channel_messages
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_channel_messages_not_deleted
  ON public.channel_messages (created_at DESC) WHERE deleted_at IS NULL;

-- kb_entries
ALTER TABLE public.kb_entries
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_kb_entries_not_deleted
  ON public.kb_entries (created_at DESC) WHERE deleted_at IS NULL;

-- ai_memory
ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_ai_memory_not_deleted
  ON public.ai_memory (created_at DESC) WHERE deleted_at IS NULL;

-- email_address_rules
ALTER TABLE public.email_address_rules
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_email_address_rules_not_deleted
  ON public.email_address_rules (created_at DESC) WHERE deleted_at IS NULL;

-- import_logs
ALTER TABLE public.import_logs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_import_logs_not_deleted
  ON public.import_logs (created_at DESC) WHERE deleted_at IS NULL;
