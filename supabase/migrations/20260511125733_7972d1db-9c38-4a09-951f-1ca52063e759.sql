-- ============================================================
-- Hot-path indexes — based on pg_stat_user_tables seq scan analysis
-- ============================================================

-- ── partner_contacts (137k rows, 7.4B seq tup read — CRITICAL) ──
-- FK to partners had NO supporting index → every partner detail / list join was a full scan.
CREATE INDEX IF NOT EXISTS idx_partner_contacts_partner_id
  ON public.partner_contacts (partner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_contacts_partner_primary
  ON public.partner_contacts (partner_id, is_primary DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── partner_networks (895M seq tup read — FK without index) ──
CREATE INDEX IF NOT EXISTS idx_partner_networks_partner_id
  ON public.partner_networks (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_networks_name
  ON public.partner_networks (network_name);

-- ── agent_tasks (177M seq tup read) ──
-- Queue polling: status + scheduled_at; per-user list; per-agent grouping.
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_scheduled
  ON public.agent_tasks (status, scheduled_at NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_status
  ON public.agent_tasks (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id
  ON public.agent_tasks (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending
  ON public.agent_tasks (scheduled_at)
  WHERE status = 'pending';

-- ── imported_contacts (201M seq tup read) ──
-- Holding pattern, lead-status filters, country dropdowns, recent-activity sorts.
CREATE INDEX IF NOT EXISTS idx_imported_contacts_lead_status
  ON public.imported_contacts (lead_status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_country
  ON public.imported_contacts (country, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_origin
  ON public.imported_contacts (origin)
  WHERE deleted_at IS NULL AND origin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_holding
  ON public.imported_contacts (last_interaction_at DESC NULLS LAST)
  WHERE deleted_at IS NULL AND interaction_count > 0;

CREATE INDEX IF NOT EXISTS idx_imported_contacts_outreach_pool
  ON public.imported_contacts (created_at DESC)
  WHERE deleted_at IS NULL AND interaction_count = 0;

-- ── activities (60M seq tup read) — covering common agenda/cockpit queries ──
CREATE INDEX IF NOT EXISTS idx_activities_assigned_status
  ON public.activities (assigned_to, status, due_date NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_scheduled_at
  ON public.activities (scheduled_at)
  WHERE scheduled_at IS NOT NULL AND deleted_at IS NULL;

-- ── channel_messages — partner timeline often filtered + sorted ──
CREATE INDEX IF NOT EXISTS idx_channel_messages_partner_created
  ON public.channel_messages (partner_id, created_at DESC)
  WHERE partner_id IS NOT NULL AND deleted_at IS NULL;

-- Refresh planner statistics so all new indexes are picked up immediately.
ANALYZE public.partner_contacts;
ANALYZE public.partner_networks;
ANALYZE public.agent_tasks;
ANALYZE public.imported_contacts;
ANALYZE public.activities;
ANALYZE public.channel_messages;