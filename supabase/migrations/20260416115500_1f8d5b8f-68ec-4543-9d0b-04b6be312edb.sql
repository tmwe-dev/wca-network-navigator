
DO $$
DECLARE
  t_name text;
  p_name text;
  cat_a text[] := ARRAY[
    'partners','prospects','business_cards','imported_contacts',
    'partner_contacts','prospect_contacts','partner_social_links','prospect_social_links',
    'partner_services','partner_certifications','partner_networks','directory_cache'
  ];
  cat_b text[] := ARRAY[
    'ab_tests','activities','agent_action_log','agent_knowledge_links',
    'agent_personas','agent_tasks','agents','ai_conversations',
    'ai_daily_plans','ai_decision_log','ai_edit_patterns','ai_lab_test_results',
    'ai_lab_test_runs','ai_memory','ai_pending_actions','ai_plan_templates',
    'ai_request_log','ai_session_briefings','ai_work_plans','alert_config',
    'app_error_logs','app_settings','browser_action_log',
    'campaign_jobs','client_assignments','cockpit_queue','command_conversations',
    'commercial_playbooks','commercial_workflows','contact_conversation_context',
    'credit_transactions','download_jobs','download_queue',
    'edge_function_logs','email_address_rules','email_attachments',
    'email_campaign_queue','email_classifications','email_drafts','email_prompts',
    'email_sender_groups','email_sync_jobs','email_sync_state','email_templates',
    'extension_dispatch_queue','import_logs','interactions',
    'kb_entries','linkedin_flow_jobs','mission_actions','mission_slot_config',
    'network_configs','operative_prompts','outreach_missions','outreach_queue',
    'outreach_schedules','outreach_timing_templates',
    'partner_workflow_state','prospect_interactions',
    'reminders','request_logs','response_patterns','supervisor_audit_log',
    'usage_daily_budget','voice_call_sessions','workspace_documents','workspace_presets'
  ];
BEGIN
  -- STEP 1: DROP tutte le policy esistenti sulle 79 tabelle
  FOREACH t_name IN ARRAY (cat_a || cat_b) LOOP
    FOR p_name IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, t_name);
    END LOOP;
  END LOOP;

  -- STEP 2: CAT-A — base di pesca, tutti autenticati leggono/scrivono
  FOREACH t_name IN ARRAY cat_a LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t_name || '_select_shared', t_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      t_name || '_insert_shared', t_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t_name || '_update_shared', t_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
      t_name || '_delete_shared', t_name
    );
  END LOOP;

  -- STEP 3: CAT-B — personale, operator-scoped + DEFAULT auto-ownership
  FOREACH t_name IN ARRAY cat_b LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN operator_id SET DEFAULT public.get_current_operator_id()',
      t_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (operator_id IS NULL OR operator_id = ANY(public.get_effective_operator_ids()))',
      t_name || '_select_own', t_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (operator_id IS NULL OR operator_id = ANY(public.get_effective_operator_ids()))',
      t_name || '_insert_own', t_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (operator_id IS NULL OR operator_id = ANY(public.get_effective_operator_ids())) WITH CHECK (operator_id IS NULL OR operator_id = ANY(public.get_effective_operator_ids()))',
      t_name || '_update_own', t_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (operator_id IS NULL OR operator_id = ANY(public.get_effective_operator_ids()))',
      t_name || '_delete_own', t_name
    );
  END LOOP;
END $$;
