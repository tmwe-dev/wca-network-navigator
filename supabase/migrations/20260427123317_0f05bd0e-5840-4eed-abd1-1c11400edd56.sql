-- Fix get_dashboard_snapshot: prospect_total puntava erroneamente a imported_contacts.
-- Ora punta alla tabella prospects (lead non ancora confermati).

CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_today_start timestamptz := date_trunc('day', now());
BEGIN
  SELECT jsonb_build_object(
    -- Operative metrics: contacts
    'total_partners',           (SELECT count(*) FROM partners WHERE deleted_at IS NULL),
    'total_contacts',           (SELECT count(*) FROM imported_contacts),
    'new_partners',             (SELECT count(*) FROM partners WHERE deleted_at IS NULL AND lead_status = 'new'),
    'new_contacts',             (SELECT count(*) FROM imported_contacts WHERE lead_status = 'new'),
    'contacted_partners',       (SELECT count(*) FROM partners WHERE deleted_at IS NULL AND lead_status = 'first_touch_sent'),
    'contacted_contacts',       (SELECT count(*) FROM imported_contacts WHERE lead_status = 'first_touch_sent'),
    'replied_activities',       (SELECT count(*) FROM activities WHERE response_received = true),
    -- Outreach pipeline
    'schedules_active',         (SELECT count(*) FROM outreach_schedules WHERE status IN ('pending','approved','running')),
    'schedules_pending',        (SELECT count(*) FROM outreach_schedules WHERE status = 'pending'),
    'actions_approved',         (SELECT count(*) FROM mission_actions WHERE status = 'approved'),
    'actions_proposed',         (SELECT count(*) FROM mission_actions WHERE status = 'proposed'),
    -- Messages
    'sent_today',               (SELECT count(*) FROM outreach_queue WHERE status = 'sent' AND processed_at >= v_today_start),
    'awaiting_reply',           (SELECT count(*) FROM outreach_queue WHERE status = 'sent'),
    'replies_received',         (SELECT count(*) FROM outreach_queue WHERE status = 'replied'),
    -- Smart suggestions counts
    'unread_emails',            (SELECT count(*) FROM channel_messages WHERE direction = 'inbound' AND read_at IS NULL),
    'proposed_tasks',           (SELECT count(*) FROM agent_tasks WHERE status = 'proposed'),
    'draft_emails',             (SELECT count(*) FROM email_drafts WHERE status = 'draft'),
    'pending_outreach',         (SELECT count(*) FROM outreach_schedules WHERE status = 'pending'),
    'active_jobs',              (SELECT count(*) FROM download_jobs WHERE status IN ('pending','running')),
    -- Misc dashboard counts
    'partner_count',            (SELECT count(*) FROM partners WHERE deleted_at IS NULL),
    'ready_contacts_count',     (SELECT count(*) FROM cockpit_queue WHERE status = 'ready'),
    'open_activities_count',    (SELECT count(*) FROM activities WHERE status IN ('pending','in_progress')),
    -- FIX: era imported_contacts (11.4k); deve essere prospects (lead non ancora confermati).
    'prospect_total',           (SELECT count(*) FROM prospects WHERE deleted_at IS NULL),
    -- Agent task breakdowns (array)
    'agent_breakdowns', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'agent_id', a.id,
        'proposed', COALESCE((SELECT count(*) FROM agent_tasks t WHERE t.agent_id = a.id AND t.status = 'proposed'), 0),
        'running',  COALESCE((SELECT count(*) FROM agent_tasks t WHERE t.agent_id = a.id AND t.status = 'in_progress'), 0),
        'pending',  COALESCE((SELECT count(*) FROM agent_tasks t WHERE t.agent_id = a.id AND t.status = 'pending'), 0),
        'completed_today', COALESCE((SELECT count(*) FROM agent_tasks t WHERE t.agent_id = a.id AND t.status = 'completed' AND t.completed_at >= v_today_start), 0)
      ))
      FROM agents a WHERE a.is_active = true),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$function$;