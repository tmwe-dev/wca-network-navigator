-- ═══════════════════════════════════════════════════════════
-- MATERIALIZED READ MODELS — Eliminates N+1 queries per page load
-- ═══════════════════════════════════════════════════════════
--
-- Queste viste materializzate sostituiscono le 8-15 query individuali
-- che il frontend esegue per ogni pagina. Vengono aggiornate via
-- REFRESH MATERIALIZED VIEW CONCURRENTLY (non bloccante).
--
-- Pattern: CQRS Read Model — scrive su tabelle normali, legge da viste aggregate.
--
-- NOTA: Usare CONCURRENTLY richiede un UNIQUE INDEX su ogni vista.

-- ═══════════════════════════════════════════════════════════
-- 1. v_pipeline_lead — Lead pipeline dashboard
-- ══════════════════���════════════════════════════════════════
-- Replaces: partners query + activities count + last outbound + last inbound
-- Used by: Pipeline page, partner list, lead status filtering

CREATE MATERIALIZED VIEW IF NOT EXISTS v_pipeline_lead AS
SELECT
  p.id AS partner_id,
  p.user_id,
  p.company_name,
  p.company_alias,
  p.country_code,
  p.country_name,
  p.city,
  p.email,
  p.phone,
  p.lead_status,
  p.is_active,
  p.is_favorite,
  p.rating,
  p.interaction_count,
  p.last_interaction_at,
  p.created_at AS partner_created_at,
  p.enriched_at,
  p.converted_at,
  -- Aggregated touch count
  COALESCE(touch.cnt, 0)::int AS touch_count,
  -- Last outbound activity
  touch.last_outbound_at,
  -- Days since last outbound
  CASE
    WHEN touch.last_outbound_at IS NOT NULL
    THEN EXTRACT(DAY FROM NOW() - touch.last_outbound_at)::int
    ELSE 999
  END AS days_since_last_outbound,
  -- Last inbound
  inb.last_inbound_at,
  inb.last_inbound_category,
  -- Days since last inbound
  CASE
    WHEN inb.last_inbound_at IS NOT NULL
    THEN EXTRACT(DAY FROM NOW() - inb.last_inbound_at)::int
    ELSE NULL
  END AS days_since_last_inbound,
  -- Active reminders
  COALESCE(rem.pending_count, 0)::int AS pending_reminders,
  -- Has deep search results
  CASE WHEN ds.partner_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_deep_search,
  -- Primary contact
  pc.contact_name AS primary_contact_name,
  pc.contact_email AS primary_contact_email
FROM partners p
-- Touch count + last outbound
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS cnt,
    MAX(a.created_at) AS last_outbound_at
  FROM activities a
  WHERE a.partner_id = p.id
    AND a.user_id = p.user_id
    AND a.activity_type IN ('send_email', 'whatsapp_message', 'linkedin_message')
) touch ON TRUE
-- Last inbound classification
LEFT JOIN LATERAL (
  SELECT
    ec.classified_at AS last_inbound_at,
    ec.category AS last_inbound_category
  FROM email_classifications ec
  WHERE ec.partner_id = p.id
    AND ec.user_id = p.user_id
  ORDER BY ec.classified_at DESC
  LIMIT 1
) inb ON TRUE
-- Pending reminders
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS pending_count
  FROM activities a
  WHERE a.partner_id = p.id
    AND a.user_id = p.user_id
    AND a.status = 'pending'
    AND a.activity_type = 'follow_up'
) rem ON TRUE
-- Deep search existence
LEFT JOIN LATERAL (
  SELECT ds.partner_id
  FROM partner_deep_search_results ds
  WHERE ds.partner_id = p.id
  LIMIT 1
) ds ON TRUE
-- Primary contact
LEFT JOIN LATERAL (
  SELECT
    pc.name AS contact_name,
    pc.email AS contact_email
  FROM partner_contacts pc
  WHERE pc.partner_id = p.id
  ORDER BY pc.is_primary DESC NULLS LAST, pc.created_at ASC
  LIMIT 1
) pc ON TRUE;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_pipeline_lead_pk
  ON v_pipeline_lead (partner_id);
CREATE INDEX IF NOT EXISTS idx_v_pipeline_lead_user_status
  ON v_pipeline_lead (user_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_v_pipeline_lead_user_days
  ON v_pipeline_lead (user_id, days_since_last_outbound);


-- ════════════════════════��═════════════════════════════���════
-- 2. v_inbox_unified — Unified inbox view
-- ════════════��══════════════════════════════════════════════
-- Replaces: channel_messages query + partner join + classification join
-- Used by: Inbox page, email detail, message list

CREATE MATERIALIZED VIEW IF NOT EXISTS v_inbox_unified AS
SELECT
  m.id AS message_id,
  m.user_id,
  m.direction,
  m.from_address,
  m.to_address,
  m.subject,
  m.body_text,
  m.created_at AS message_date,
  m.channel,
  m.thread_id,
  m.category AS sender_category,
  m.partner_id,
  m.source_type,
  m.source_id,
  m.is_read,
  -- Partner info (denormalized)
  p.company_name AS partner_name,
  p.lead_status AS partner_lead_status,
  p.country_name AS partner_country,
  -- Classification info (denormalized)
  ec.category AS classification_category,
  ec.confidence AS classification_confidence,
  ec.urgency AS classification_urgency,
  ec.sentiment AS classification_sentiment,
  -- Email address rule
  ear.auto_action AS rule_auto_action,
  ear.category AS rule_category
FROM channel_messages m
LEFT JOIN partners p
  ON m.partner_id = p.id
LEFT JOIN LATERAL (
  SELECT ec.category, ec.confidence, ec.urgency, ec.sentiment
  FROM email_classifications ec
  WHERE ec.message_id = m.id
    AND ec.user_id = m.user_id
  ORDER BY ec.classified_at DESC
  LIMIT 1
) ec ON TRUE
LEFT JOIN LATERAL (
  SELECT ear.auto_action, ear.category
  FROM email_address_rules ear
  WHERE ear.email_address = LOWER(m.from_address)
    AND ear.user_id = m.user_id
  LIMIT 1
) ear ON TRUE;

-- Unique index for CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_inbox_unified_pk
  ON v_inbox_unified (message_id);
CREATE INDEX IF NOT EXISTS idx_v_inbox_unified_user_date
  ON v_inbox_unified (user_id, message_date DESC);
CREATE INDEX IF NOT EXISTS idx_v_inbox_unified_user_direction
  ON v_inbox_unified (user_id, direction, message_date DESC);


-- ════════════════════════════���══════════════════════════════
-- 3. v_outreach_today — Today's outreach queue
-- ════════════════════════════════════���══════════════════════
-- Replaces: outreach_queue query + partner join + contact join
-- Used by: Outreach page, daily queue

CREATE MATERIALIZED VIEW IF NOT EXISTS v_outreach_today AS
SELECT
  oq.id AS queue_id,
  oq.user_id,
  oq.channel,
  oq.recipient_name,
  oq.recipient_email,
  oq.subject,
  oq.status,
  oq.attempts,
  oq.max_attempts,
  oq.priority,
  oq.created_at,
  oq.scheduled_for,
  oq.partner_id,
  oq.contact_id,
  -- Partner info
  p.company_name AS partner_name,
  p.lead_status AS partner_lead_status,
  p.country_name AS partner_country,
  -- Mission info
  oq.mission_id,
  om.name AS mission_name,
  -- Last touch info
  lt.last_outbound_at,
  lt.last_channel
FROM outreach_queue oq
LEFT JOIN partners p ON oq.partner_id = p.id
LEFT JOIN outreach_missions om ON oq.mission_id = om.id
LEFT JOIN LATERAL (
  SELECT
    MAX(a.created_at) AS last_outbound_at,
    (ARRAY_AGG(a.activity_type ORDER BY a.created_at DESC))[1] AS last_channel
  FROM activities a
  WHERE a.partner_id = oq.partner_id
    AND a.user_id = oq.user_id
    AND a.activity_type IN ('send_email', 'whatsapp_message', 'linkedin_message')
) lt ON oq.partner_id IS NOT NULL;

-- Unique index for CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_outreach_today_pk
  ON v_outreach_today (queue_id);
CREATE INDEX IF NOT EXISTS idx_v_outreach_today_user_status
  ON v_outreach_today (user_id, status, scheduled_for);


-- ══════════════════════════════���═══════════════════════��════
-- 4. v_kpi_dashboard — KPI aggregation view
-- ═════════════════════════════════════════════════��═════════
-- Replaces: 8-12 individual COUNT queries on dashboard load
-- Used by: Dashboard page, KPI widgets

CREATE MATERIALIZED VIEW IF NOT EXISTS v_kpi_dashboard AS
SELECT
  u.user_id,
  -- Partner counts by status
  COUNT(*) FILTER (WHERE TRUE) AS total_partners,
  COUNT(*) FILTER (WHERE p.lead_status = 'new') AS partners_new,
  COUNT(*) FILTER (WHERE p.lead_status = 'first_touch_sent') AS partners_first_touch,
  COUNT(*) FILTER (WHERE p.lead_status = 'holding') AS partners_holding,
  COUNT(*) FILTER (WHERE p.lead_status = 'engaged') AS partners_engaged,
  COUNT(*) FILTER (WHERE p.lead_status = 'qualified') AS partners_qualified,
  COUNT(*) FILTER (WHERE p.lead_status = 'negotiation') AS partners_negotiation,
  COUNT(*) FILTER (WHERE p.lead_status = 'converted') AS partners_converted,
  COUNT(*) FILTER (WHERE p.lead_status = 'archived') AS partners_archived,
  COUNT(*) FILTER (WHERE p.lead_status = 'blacklisted') AS partners_blacklisted,
  -- Activity stats (last 30 days)
  COALESCE(act.emails_sent_30d, 0)::int AS emails_sent_30d,
  COALESCE(act.whatsapp_sent_30d, 0)::int AS whatsapp_sent_30d,
  COALESCE(act.linkedin_sent_30d, 0)::int AS linkedin_sent_30d,
  COALESCE(act.total_outbound_30d, 0)::int AS total_outbound_30d,
  -- Pending actions
  COALESCE(pa.pending_actions, 0)::int AS pending_actions,
  COALESCE(pa.pending_high_priority, 0)::int AS pending_high_priority,
  -- Inbox stats
  COALESCE(inbox.unread_messages, 0)::int AS unread_messages,
  COALESCE(inbox.inbound_today, 0)::int AS inbound_today,
  -- Outreach queue
  COALESCE(oq.queue_pending, 0)::int AS outreach_queue_pending,
  COALESCE(oq.queue_sent_today, 0)::int AS outreach_sent_today
FROM (SELECT DISTINCT user_id FROM partners) u
LEFT JOIN partners p ON p.user_id = u.user_id
-- Activity stats
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE a.activity_type = 'send_email') AS emails_sent_30d,
    COUNT(*) FILTER (WHERE a.activity_type = 'whatsapp_message') AS whatsapp_sent_30d,
    COUNT(*) FILTER (WHERE a.activity_type = 'linkedin_message') AS linkedin_sent_30d,
    COUNT(*) FILTER (WHERE a.activity_type IN ('send_email', 'whatsapp_message', 'linkedin_message')) AS total_outbound_30d
  FROM activities a
  WHERE a.user_id = u.user_id
    AND a.created_at >= NOW() - INTERVAL '30 days'
) act ON TRUE
-- Pending actions
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS pending_actions,
    COUNT(*) FILTER (WHERE pa.priority IN ('high', 'critical')) AS pending_high_priority
  FROM ai_pending_actions pa
  WHERE pa.user_id = u.user_id
    AND pa.status = 'pending'
) pa ON TRUE
-- Inbox stats
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE m.is_read = FALSE AND m.direction = 'inbound') AS unread_messages,
    COUNT(*) FILTER (WHERE m.direction = 'inbound' AND m.created_at >= CURRENT_DATE) AS inbound_today
  FROM channel_messages m
  WHERE m.user_id = u.user_id
) inbox ON TRUE
-- Outreach queue
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE oq.status = 'pending') AS queue_pending,
    COUNT(*) FILTER (WHERE oq.status = 'sent' AND oq.updated_at >= CURRENT_DATE) AS queue_sent_today
  FROM outreach_queue oq
  WHERE oq.user_id = u.user_id
) oq ON TRUE
GROUP BY u.user_id, act.emails_sent_30d, act.whatsapp_sent_30d, act.linkedin_sent_30d,
         act.total_outbound_30d, pa.pending_actions, pa.pending_high_priority,
         inbox.unread_messages, inbox.inbound_today, oq.queue_pending, oq.queue_sent_today;

-- Unique index for CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_kpi_dashboard_pk
  ON v_kpi_dashboard (user_id);


-- ══════════════════════════���════════════════════════════════
-- 5. REFRESH FUNCTION — Called by pg_cron or manual trigger
-- ══��═════════════════════════��══════════════════════════════

CREATE OR REPLACE FUNCTION refresh_read_models()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CONCURRENTLY allows reads during refresh (no lock)
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_pipeline_lead;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_inbox_unified;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_outreach_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_kpi_dashboard;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION refresh_read_models() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 6. RLS POLICIES — Read-only access per user
-- ═══════════════════════════════════════════════════════════

ALTER MATERIALIZED VIEW v_pipeline_lead OWNER TO postgres;
ALTER MATERIALIZED VIEW v_inbox_unified OWNER TO postgres;
ALTER MATERIALIZED VIEW v_outreach_today OWNER TO postgres;
ALTER MATERIALIZED VIEW v_kpi_dashboard OWNER TO postgres;

-- Note: Materialized views don't support RLS directly.
-- Access control is enforced at the application layer via user_id filtering.
-- The views are read-only by design (no INSERT/UPDATE/DELETE possible).

-- ══════════════��════════════════════════════════════════════
-- 7. INITIAL REFRESH
-- ═════════════════════════════���═════════════════════════════

-- Populate the views with initial data
REFRESH MATERIALIZED VIEW v_pipeline_lead;
REFRESH MATERIALIZED VIEW v_inbox_unified;
REFRESH MATERIALIZED VIEW v_outreach_today;
REFRESH MATERIALIZED VIEW v_kpi_dashboard;
