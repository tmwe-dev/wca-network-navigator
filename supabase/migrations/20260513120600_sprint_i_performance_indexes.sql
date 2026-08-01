-- Sprint I: Performance — Critical composite indexes for hot queries.
-- These cover the most frequent query patterns identified from
-- edge_function_logs and React Query refetch patterns.

-- 1. channel_messages: inbox grouped by partner + folder
CREATE INDEX IF NOT EXISTS idx_channel_messages_partner_direction_created
  ON public.channel_messages(partner_id, direction, created_at DESC)
  WHERE direction = 'inbound';

-- 2. ai_pending_actions: pending queue (drainer + UI dashboard)
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status_created
  ON public.ai_pending_actions(status, created_at DESC)
  WHERE status IN ('pending', 'approved');

-- 3. activities: today view + agenda
CREATE INDEX IF NOT EXISTS idx_activities_user_date
  ON public.activities(user_id, scheduled_at DESC)
  WHERE scheduled_at IS NOT NULL;

-- 4. partners: search + sort by last outbound
CREATE INDEX IF NOT EXISTS idx_partners_last_outbound
  ON public.partners(last_outbound_at DESC NULLS LAST)
  WHERE last_outbound_at IS NOT NULL;

-- 5. operative_prompts: active prompts lookup
CREATE INDEX IF NOT EXISTS idx_operative_prompts_active_name
  ON public.operative_prompts(name, updated_at DESC)
  WHERE is_active = true;

-- 6. funnemail_decisions: recent decisions by message
CREATE INDEX IF NOT EXISTS idx_funnemail_decisions_message_created
  ON public.funnemail_decisions(message_id, created_at DESC);

-- 7. email_address_rules: uncategorized lookup
CREATE INDEX IF NOT EXISTS idx_email_address_rules_uncategorized
  ON public.email_address_rules(email_address)
  WHERE group_id IS NULL AND is_active = true;

-- 8. edge_function_logs: metrics aggregation (24h window)
CREATE INDEX IF NOT EXISTS idx_edge_function_logs_recent
  ON public.edge_function_logs(created_at DESC, function_name)
  WHERE created_at > now() - interval '48 hours';

-- 9. supervisor_audit_log: admin feed with pagination
CREATE INDEX IF NOT EXISTS idx_supervisor_audit_log_feed
  ON public.supervisor_audit_log(created_at DESC, actor_type, category);

-- 10. ai_decision_log: recent decisions per user
CREATE INDEX IF NOT EXISTS idx_ai_decision_log_user_recent
  ON public.ai_decision_log(user_id, created_at DESC);
