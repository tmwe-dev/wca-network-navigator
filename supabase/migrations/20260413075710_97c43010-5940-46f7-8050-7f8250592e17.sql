
CREATE TABLE public.supervisor_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user','ai_agent','system','cron')),
  actor_id text,
  actor_name text,
  action_category text NOT NULL CHECK (action_category IN ('email_sent','email_drafted','email_approved','email_rejected','email_modified','email_classified','campaign_started','campaign_paused','campaign_resumed','campaign_cancelled','mission_created','mission_completed','mission_failed','activity_created','activity_updated','activity_deleted','reminder_created','reminder_completed','workflow_advanced','workflow_gate_passed','partner_updated','contact_updated','rule_created','rule_updated','pending_action_approved','pending_action_rejected','ai_auto_executed','cadence_scheduled','cadence_cancelled','cadence_executed','threshold_adjusted','profile_updated','queue_modified','bulk_action','manual_send','agent_assigned','settings_changed')),
  action_detail text NOT NULL,
  target_type text CHECK (target_type IN ('partner','contact','email','activity','mission','campaign','workflow','rule','pending_action','queue','agent','settings')),
  target_id uuid,
  target_label text,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  contact_id uuid,
  email_address text,
  decision_origin text NOT NULL DEFAULT 'manual' CHECK (decision_origin IN ('manual','ai_auto','ai_approved','ai_rejected','ai_modified','system_cron','system_trigger')),
  ai_decision_log_id uuid REFERENCES public.ai_decision_log(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.supervisor_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own audit" ON public.supervisor_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts audit" ON public.supervisor_audit_log
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_supervisor_user_created ON public.supervisor_audit_log(user_id, created_at DESC);
CREATE INDEX idx_supervisor_category ON public.supervisor_audit_log(user_id, action_category);
CREATE INDEX idx_supervisor_partner ON public.supervisor_audit_log(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_supervisor_origin ON public.supervisor_audit_log(user_id, decision_origin);
CREATE INDEX idx_supervisor_actor ON public.supervisor_audit_log(user_id, actor_type);
