-- Multi-tenant M2: link operators.user_id via email + re-backfill operator_id.
-- Idempotente: UPDATE solo su righe con user_id IS NULL (step 1)
-- e con operator_id IS NULL AND user_id IS NOT NULL (step 2).

-- STEP 1: link Luigi e Imane operator record to auth user via email match
UPDATE public.operators o
SET user_id = u.id,
    updated_at = now()
FROM auth.users u
WHERE o.email = u.email
  AND o.user_id IS NULL
  AND o.email IN ('luigi@tmwe.it', 'imane@tmwe.it');

-- STEP 2: re-backfill operator_id sulle 79 tabelle user-scoped
DO $$
DECLARE
  t_name text;
  col_type text;
  t_list text[] := ARRAY[
    'ab_tests','activities','agent_action_log','agent_knowledge_links',
    'agent_personas','agent_tasks','agents','ai_conversations',
    'ai_daily_plans','ai_decision_log','ai_edit_patterns','ai_lab_test_results',
    'ai_lab_test_runs','ai_memory','ai_pending_actions','ai_plan_templates',
    'ai_request_log','ai_session_briefings','ai_work_plans','alert_config',
    'app_error_logs','app_settings','browser_action_log','business_cards',
    'campaign_jobs','client_assignments','cockpit_queue','command_conversations',
    'commercial_playbooks','commercial_workflows','contact_conversation_context',
    'credit_transactions','directory_cache','download_jobs','download_queue',
    'edge_function_logs','email_address_rules','email_attachments',
    'email_campaign_queue','email_classifications','email_drafts','email_prompts',
    'email_sender_groups','email_sync_jobs','email_sync_state','email_templates',
    'extension_dispatch_queue','import_logs','imported_contacts','interactions',
    'kb_entries','linkedin_flow_jobs','mission_actions','mission_slot_config',
    'network_configs','operative_prompts','outreach_missions','outreach_queue',
    'outreach_schedules','outreach_timing_templates','partner_certifications',
    'partner_contacts','partner_networks','partner_services','partner_social_links',
    'partner_workflow_state','partners','prospect_contacts','prospect_interactions',
    'prospect_social_links','prospects','reminders','request_logs',
    'response_patterns','supervisor_audit_log','usage_daily_budget',
    'voice_call_sessions','workspace_documents','workspace_presets'
  ];
BEGIN
  FOREACH t_name IN ARRAY t_list LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = t_name
      AND column_name = 'user_id';

    IF col_type IS NOT NULL THEN
      IF col_type = 'uuid' THEN
        EXECUTE format(
          'UPDATE public.%I t SET operator_id = o.id FROM public.operators o WHERE o.user_id = t.user_id AND t.operator_id IS NULL AND t.user_id IS NOT NULL',
          t_name
        );
      ELSE
        EXECUTE format(
          'UPDATE public.%I t SET operator_id = o.id FROM public.operators o WHERE o.user_id = t.user_id::uuid AND t.operator_id IS NULL AND t.user_id IS NOT NULL',
          t_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;