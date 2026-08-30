/** GENERATO da scripts/gen-galaxy-synapses.mjs — non modificare a mano. */
export const FN_TABLES: Readonly<Record<string, readonly string[]>> = {
  "agent-audit": [
    "agent_capabilities",
    "agent_personas",
    "agents",
    "operative_prompts"
  ],
  "agent-autonomous-cycle": [
    "activities",
    "agent_tasks",
    "agents",
    "app_settings",
    "business_cards",
    "channel_messages",
    "client_assignments",
    "domain_events",
    "imported_contacts",
    "partner_social_links",
    "partners",
    "supervisor_audit_log",
    "system_flags"
  ],
  "agent-autopilot-worker": [
    "agent_mission_events",
    "agent_missions",
    "edge_metrics",
    "system_flags"
  ],
  "agent-execute": [
    "activities",
    "agent_knowledge_links",
    "agent_missions",
    "agent_personas",
    "agent_tasks",
    "agents",
    "ai_decision_log",
    "ai_memory",
    "ai_pending_actions",
    "ai_routing_config",
    "ai_work_plans",
    "app_settings",
    "blacklist",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "client_assignments",
    "contact_conversation_context",
    "contact_interactions",
    "directory_members",
    "domain_events",
    "download_job_items",
    "download_jobs",
    "edge_metrics",
    "email_address_rules",
    "email_campaign_queue",
    "email_classifications",
    "imported_contacts",
    "interactions",
    "kb_entries",
    "operative_prompts",
    "outreach_missions",
    "outreach_queue",
    "partner_contacts",
    "partners",
    "prospects",
    "reminders",
    "sherlock_investigations",
    "suggested_improvements",
    "supervisor_audit_log",
    "workspace_presets"
  ],
  "agent-loop": [
    "agent_capabilities",
    "agent_personas",
    "edge_metrics",
    "operative_prompts",
    "usage_daily_budget"
  ],
  "agent-prompt-refiner": [
    "agents",
    "ai_memory",
    "ai_pending_actions",
    "edge_metrics",
    "supervisor_audit_log"
  ],
  "agent-simulate": [
    "agent_capabilities",
    "agent_personas",
    "operative_prompts"
  ],
  "agent-task-drainer": [
    "agent_tasks",
    "app_settings",
    "edge_metrics",
    "system_flags"
  ],
  "agentic-decide": [
    "edge_metrics"
  ],
  "ai-arena-suggest": [
    "activities",
    "ai_routing_config",
    "app_settings",
    "edge_metrics",
    "partner_contacts",
    "partners"
  ],
  "ai-assistant": [
    "activities",
    "agent_knowledge_links",
    "agent_tasks",
    "agents",
    "ai_invocation_audit",
    "ai_memory",
    "ai_pending_actions",
    "ai_plan_templates",
    "ai_scope_registry",
    "ai_work_plans",
    "app_settings",
    "blacklist",
    "blacklist_entries",
    "business_cards",
    "calendar_events",
    "channel_messages",
    "commercial_playbooks",
    "commercial_workflows",
    "contact_conversation_context",
    "contact_interactions",
    "deals",
    "directory_cache",
    "download_job_items",
    "download_jobs",
    "edge_metrics",
    "email_address_rules",
    "email_campaign_queue",
    "email_classifications",
    "import_errors",
    "import_logs",
    "imported_contacts",
    "interactions",
    "kb_entries",
    "notifications",
    "operative_prompts",
    "outreach_missions",
    "outreach_queue",
    "partner_certifications",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partner_social_links",
    "partner_workflow_state",
    "partners",
    "partners_no_contacts",
    "prospect_contacts",
    "prospects",
    "reminders",
    "supervisor_audit_log",
    "user_api_keys",
    "user_credits"
  ],
  "ai-backup": [
    "agent_personas",
    "ai_memory",
    "app_settings",
    "edge_metrics",
    "kb_entries",
    "operative_prompts",
    "profiles"
  ],
  "ai-deep-search-helper": [
    "ai_routing_config",
    "app_settings",
    "edge_metrics"
  ],
  "ai-gateway-micro": [
    "ai_routing_config",
    "edge_metrics"
  ],
  "ai-match-business-cards": [
    "business_cards",
    "edge_metrics",
    "partners"
  ],
  "ai-monitor": [
    "ai_budget_config",
    "edge_metrics"
  ],
  "ai-query-planner": [
    "ai_routing_config",
    "edge_metrics"
  ],
  "ai-test-runner": [
    "ai_test_scenarios"
  ],
  "ai-tracking-healthcheck": [
    "ai_prompt_log"
  ],
  "ai-utility": [
    "edge_metrics"
  ],
  "analyze-email-edit": [
    "ai_routing_config",
    "app_settings",
    "edge_metrics"
  ],
  "analyze-import-structure": [],
  "analyze-partner": [
    "channel_messages",
    "credit_transactions",
    "partner_services",
    "partners",
    "user_api_keys",
    "user_credits"
  ],
  "apply-classification-insight": [
    "ai_classification_insights",
    "edge_metrics",
    "email_sender_groups",
    "operative_prompts"
  ],
  "apply-email-rules": [
    "channel_messages",
    "edge_metrics",
    "email_address_rules"
  ],
  "backfill-email-rules": [
    "channel_messages",
    "edge_metrics",
    "email_address_rules"
  ],
  "batch-enrichment-worker": [
    "app_settings",
    "partners",
    "system_flags"
  ],
  "browser-action": [
    "browser_action_log",
    "edge_metrics"
  ],
  "cadence-engine": [
    "ai_decision_log",
    "ai_pending_actions",
    "app_settings",
    "contact_conversation_context",
    "edge_metrics",
    "email_address_rules",
    "email_classifications",
    "mission_actions",
    "system_flags"
  ],
  "calculate-lead-scores": [
    "business_cards",
    "contact_interactions",
    "imported_contacts"
  ],
  "calculate-partner-quality": [
    "partner_certifications",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partners",
    "sherlock_investigations"
  ],
  "categorize-content": [
    "edge_metrics"
  ],
  "check-external-db": [],
  "check-inbox": [
    "activities",
    "ai_pending_actions",
    "ai_routing_config",
    "app_settings",
    "blacklist",
    "brand_voice_audits",
    "channel_messages",
    "domain_events",
    "edge_metrics",
    "email_address_rules",
    "email_attachments",
    "email_campaign_queue",
    "email_mailboxes",
    "email_sync_state",
    "imported_contacts",
    "inbound_enrichment_queue",
    "operators",
    "partner_contacts",
    "partners",
    "prospects",
    "shared_mailboxes",
    "supervisor_audit_log"
  ],
  "check-inbox-booking": [
    "activities",
    "ai_pending_actions",
    "ai_routing_config",
    "app_settings",
    "blacklist",
    "brand_voice_audits",
    "channel_messages",
    "domain_events",
    "edge_metrics",
    "email_address_rules",
    "email_attachments",
    "email_campaign_queue",
    "email_mailboxes",
    "email_sync_state",
    "imported_contacts",
    "inbound_enrichment_queue",
    "operators",
    "partner_contacts",
    "partners",
    "prospects",
    "supervisor_audit_log"
  ],
  "classify-emails-batch": [
    "channel_messages",
    "reply_classifications"
  ],
  "classify-inbound-content": [
    "ai_pending_actions",
    "channel_messages",
    "contact_conversation_context",
    "edge_metrics",
    "email_content_intelligence",
    "operative_prompts",
    "partner_outreach_state",
    "partners",
    "system_doctrine"
  ],
  "classify-inbound-message": [
    "activities",
    "ai_pending_actions",
    "ai_routing_config",
    "app_settings",
    "blacklist",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "domain_events",
    "edge_metrics",
    "email_address_rules",
    "email_campaign_queue",
    "email_mailboxes",
    "email_sender_groups",
    "funnemail_actions_log",
    "imported_contacts",
    "operative_prompts",
    "outreach_missions",
    "partner_contacts",
    "partners",
    "pipeline_traces",
    "prompt_injection_reviews",
    "reply_classifications",
    "supervisor_audit_log"
  ],
  "command-ask-brain": [
    "bridge_tokens",
    "edge_metrics"
  ],
  "confirm-injection-review": [
    "prompt_injection_reviews"
  ],
  "consume-credits": [
    "user_api_keys"
  ],
  "country-kb-generator": [
    "ai_routing_config",
    "app_settings",
    "edge_metrics",
    "kb_entries",
    "partners"
  ],
  "daily-briefing": [
    "activities",
    "agent_tasks",
    "agents",
    "ai_routing_config",
    "app_settings",
    "channel_messages",
    "download_jobs",
    "edge_metrics",
    "email_campaign_queue",
    "imported_contacts",
    "kb_entries",
    "partners"
  ],
  "decision-dashboard": [
    "activities",
    "ai_pending_actions",
    "app_settings",
    "business_cards",
    "channel_messages",
    "domain_events",
    "email_classifications",
    "imported_contacts",
    "partners",
    "supervisor_audit_log"
  ],
  "deduplicate-contacts": [
    "contact_interactions",
    "edge_metrics",
    "imported_contacts"
  ],
  "deduplicate-partners": [
    "blacklist_entries",
    "campaign_jobs",
    "email_campaign_queue",
    "partners"
  ],
  "dispatch-integrity-check": [
    "activities",
    "ai_pending_actions",
    "channel_messages",
    "dispatch_integrity_report",
    "edge_metrics",
    "partners"
  ],
  "dispatch-urgent-alert": [
    "alert_dispatch_log",
    "alert_recipients",
    "extension_dispatch_queue"
  ],
  "elevenlabs-agent-sync": [
    "agents",
    "edge_metrics"
  ],
  "elevenlabs-conversation-token": [
    "agents",
    "bridge_tokens",
    "edge_metrics"
  ],
  "elevenlabs-tts": [
    "app_settings",
    "edge_metrics"
  ],
  "email-cron-sync": [
    "app_settings",
    "edge_metrics",
    "email_sync_state",
    "operator_mailbox_access",
    "operators",
    "profiles",
    "shared_mailboxes",
    "system_flags"
  ],
  "email-delivery-webhook": [
    "edge_metrics",
    "email_delivery_events"
  ],
  "email-imap-proxy": [
    "edge_metrics",
    "shared_mailboxes"
  ],
  "email-sync-worker": [
    "edge_metrics",
    "email_sync_jobs"
  ],
  "enrich-partner-website": [
    "ai_extract_cache",
    "app_settings",
    "partners",
    "scrape_cache"
  ],
  "export-audit-csv": [
    "agent_action_log",
    "edge_metrics"
  ],
  "finder-api-chat": [
    "finder_api_kb",
    "finder_api_schema_map",
    "tmwe_api_catalog"
  ],
  "funnemail-auto-route": [
    "channel_messages",
    "edge_metrics",
    "email_address_rules",
    "email_sender_groups",
    "funnemail_routing_config",
    "funnemail_routing_rules",
    "pipeline_traces"
  ],
  "funnemail-backfill-inbound": [
    "channel_messages",
    "email_address_rules",
    "email_sender_groups",
    "funnemail_decisions"
  ],
  "funnemail-classify": [
    "edge_metrics",
    "funnemail_decisions",
    "funnemail_folders",
    "operative_prompts"
  ],
  "funnemail-policy-engine": [
    "edge_metrics",
    "email_address_rules",
    "email_sender_groups"
  ],
  "funnemail-policy-executor": [
    "edge_metrics",
    "funnemail_actions_log"
  ],
  "funnemail-reminders-tick": [
    "funnemail_actions_log",
    "funnemail_escalation_events",
    "funnemail_jobs_v",
    "funnemail_message_reminders",
    "funnemail_routing_config"
  ],
  "funnemail-scout-sender": [
    "contacts",
    "funnemail_scout_cache",
    "funnemail_sender_intel",
    "partners"
  ],
  "funnemail-send-autoresponder": [
    "edge_metrics",
    "funnemail_autoresponder_log",
    "funnemail_autoresponder_templates"
  ],
  "generate-aliases": [
    "edge_metrics",
    "imported_contacts",
    "operative_prompts",
    "partner_contacts",
    "partners"
  ],
  "generate-content": [
    "edge_metrics"
  ],
  "generate-email": [
    "activities",
    "ai_edit_patterns",
    "ai_memory",
    "ai_routing_config",
    "ai_token_usage",
    "app_settings",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "commercial_playbooks",
    "commercial_workflows",
    "contact_conversation_context",
    "edge_metrics",
    "email_address_rules",
    "email_classifications",
    "imported_contacts",
    "interactions",
    "kb_entries",
    "operative_prompts",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partner_social_links",
    "partner_workflow_state",
    "partners",
    "prospect_contacts",
    "prospects",
    "response_patterns",
    "sherlock_investigations",
    "suggested_improvements",
    "supervisor_audit_log",
    "system_doctrine",
    "workspace_documents"
  ],
  "generate-outreach": [
    "activities",
    "ai_routing_config",
    "ai_token_usage",
    "app_settings",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "commercial_playbooks",
    "commercial_workflows",
    "contact_conversation_context",
    "edge_metrics",
    "email_address_rules",
    "email_classifications",
    "imported_contacts",
    "interactions",
    "kb_entries",
    "operative_prompts",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partner_workflow_state",
    "partners",
    "sherlock_investigations"
  ],
  "get-linkedin-credentials": [
    "app_settings",
    "edge_metrics"
  ],
  "get-ra-credentials": [
    "app_settings",
    "edge_metrics"
  ],
  "get-wca-credentials": [
    "edge_metrics",
    "user_wca_credentials"
  ],
  "harmonize-proposal-chat": [
    "agents",
    "edge_metrics",
    "harmonize_runs",
    "kb_entries"
  ],
  "health-check": [
    "agents",
    "ai_pending_actions",
    "edge_metrics",
    "reply_classifications"
  ],
  "imap-list-folders": [],
  "improve-email": [
    "activities",
    "ai_memory",
    "ai_routing_config",
    "ai_token_usage",
    "app_settings",
    "brand_voice_audits",
    "channel_messages",
    "edge_metrics",
    "kb_entries",
    "operative_prompts",
    "partner_contacts",
    "partner_workflow_state",
    "partners",
    "sherlock_investigations",
    "suggested_improvements"
  ],
  "install-vault-service-role-key": [],
  "kb-doctrine-audit": [
    "kb_audit_reports",
    "kb_entries"
  ],
  "kb-embed-backfill": [
    "edge_metrics",
    "kb_entries"
  ],
  "kb-index-map": [
    "kb_entries"
  ],
  "kb-ingest-document": [
    "edge_metrics",
    "kb_entries"
  ],
  "kb-intake-analyze": [
    "kb_entries"
  ],
  "kb-promoter": [
    "kb_entries",
    "system_flags"
  ],
  "kb-supervisor": [
    "activities",
    "commercial_playbooks",
    "edge_metrics",
    "kb_entries"
  ],
  "learn-from-group-correction": [
    "ai_decision_log",
    "channel_messages",
    "edge_metrics",
    "email_address_rules",
    "kb_entries"
  ],
  "linkedin-ai-extract": [
    "ai_routing_config",
    "edge_metrics"
  ],
  "linkedin-profile-api": [
    "edge_metrics"
  ],
  "list-elevenlabs-voices": [
    "edge_metrics"
  ],
  "log-action": [
    "activities",
    "ai_pending_actions",
    "business_cards",
    "channel_messages",
    "contact_interactions",
    "domain_events",
    "edge_metrics",
    "imported_contacts",
    "interactions",
    "partners",
    "suggested_improvements",
    "supervisor_audit_log"
  ],
  "manage-email-folders": [
    "channel_messages",
    "edge_metrics",
    "shared_mailboxes"
  ],
  "mark-imap-seen": [
    "channel_messages",
    "edge_metrics",
    "shared_mailboxes"
  ],
  "mcp": [
    "agents",
    "partners"
  ],
  "memory-embed-backfill": [
    "ai_memory",
    "edge_metrics"
  ],
  "memory-promoter": [
    "ai_decision_log",
    "ai_memory",
    "edge_metrics",
    "email_address_rules",
    "system_flags"
  ],
  "mission-executor": [
    "edge_metrics",
    "mission_actions",
    "mission_slot_config",
    "outreach_missions",
    "supervisor_audit_log"
  ],
  "optimus-analyze": [
    "edge_metrics",
    "operators",
    "scraper_agent_log",
    "scraper_agent_memory"
  ],
  "outreach-scheduler": [
    "activities",
    "channel_messages",
    "edge_metrics",
    "imported_contacts",
    "mission_actions",
    "outreach_missions",
    "outreach_schedules",
    "system_flags"
  ],
  "parse-business-card": [
    "edge_metrics"
  ],
  "parse-profile-ai": [
    "edge_metrics",
    "partner_certifications",
    "partner_contacts",
    "partner_networks",
    "partners"
  ],
  "pending-action-executor": [
    "activities",
    "ai_pending_actions",
    "app_settings",
    "business_cards",
    "channel_messages",
    "domain_events",
    "edge_metrics",
    "email_address_rules",
    "imported_contacts",
    "outreach_schedules",
    "partners",
    "supervisor_audit_log"
  ],
  "process-ai-import": [
    "edge_metrics",
    "import_errors",
    "import_logs",
    "imported_contacts"
  ],
  "process-download-job": [
    "channel_messages",
    "directory_cache",
    "download_jobs",
    "edge_metrics",
    "network_configs",
    "partner_contacts",
    "partner_networks",
    "partners"
  ],
  "process-email-queue": [
    "activities",
    "ai_pending_actions",
    "ai_routing_config",
    "app_settings",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "contact_interactions",
    "domain_events",
    "edge_metrics",
    "email_campaign_queue",
    "email_drafts",
    "email_send_log",
    "imported_contacts",
    "interactions",
    "partners",
    "suggested_improvements",
    "supervisor_audit_log"
  ],
  "process-inbound-enrichment": [
    "ai_routing_config",
    "channel_messages",
    "edge_metrics",
    "inbound_enrichment_queue",
    "operative_prompts"
  ],
  "prompt-copilot-chat": [
    "kb_entries",
    "operative_prompts"
  ],
  "prompt-registry-drift-check": [
    "operative_prompts"
  ],
  "prompt-test-runner": [
    "app_settings",
    "edge_metrics",
    "kb_entries",
    "operative_prompts",
    "prompt_test_cases",
    "prompt_test_runs",
    "prompt_versions",
    "system_flags"
  ],
  "recalculate-partner-quality": [
    "partners"
  ],
  "receive-channel-message": [
    "channel_messages",
    "edge_metrics",
    "extension_dispatch_queue",
    "operators"
  ],
  "record-e2e-run": [
    "e2e_run_results"
  ],
  "refine-classification-rule": [
    "ai_classification_insights",
    "channel_messages",
    "edge_metrics",
    "email_address_rules",
    "email_sender_groups",
    "operative_prompts"
  ],
  "refresh-conversation-context": [
    "channel_messages",
    "contact_conversation_context",
    "edge_metrics",
    "operative_prompts",
    "partners"
  ],
  "replay-domain-events": [
    "activities",
    "ai_pending_actions",
    "ai_routing_config",
    "app_settings",
    "blacklist",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "domain_events",
    "edge_metrics",
    "email_address_rules",
    "email_campaign_queue",
    "email_mailboxes",
    "imported_contacts",
    "partner_contacts",
    "partners",
    "supervisor_audit_log"
  ],
  "response-pattern-aggregator": [
    "activities",
    "edge_metrics",
    "kb_entries",
    "partners",
    "response_patterns"
  ],
  "review-message": [
    "ai_routing_config",
    "app_settings",
    "brand_voice_audits",
    "edge_metrics",
    "imported_contacts",
    "partners"
  ],
  "run-funnemail-eval": [
    "funnemail_eval_cases",
    "funnemail_eval_runs"
  ],
  "save-correction-memory": [
    "ai_memory",
    "edge_metrics",
    "email_address_rules",
    "supervisor_audit_log"
  ],
  "save-linkedin-cookie": [
    "app_settings",
    "edge_metrics",
    "user_linkedin_sessions"
  ],
  "save-linkedin-credentials": [
    "app_settings"
  ],
  "save-ra-cookie": [
    "app_settings",
    "edge_metrics",
    "user_ra_sessions"
  ],
  "save-ra-prospects": [
    "edge_metrics",
    "prospect_contacts",
    "prospects"
  ],
  "save-wca-contacts": [
    "edge_metrics",
    "partner_certifications",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partners"
  ],
  "save-wca-cookie": [
    "app_settings",
    "edge_metrics",
    "user_wca_sessions"
  ],
  "scrape-website": [
    "edge_metrics",
    "scrape_cache"
  ],
  "send-email": [
    "activities",
    "agents",
    "ai_pending_actions",
    "ai_routing_config",
    "app_settings",
    "blacklist",
    "brand_voice_audits",
    "business_cards",
    "channel_messages",
    "contact_interactions",
    "domain_events",
    "edge_metrics",
    "email_campaign_queue",
    "email_send_log",
    "imported_contacts",
    "interactions",
    "operator_mailbox_access",
    "operators",
    "partners",
    "shared_mailboxes",
    "suggested_improvements",
    "supervisor_audit_log"
  ],
  "send-linkedin": [
    "ai_routing_config",
    "app_settings",
    "brand_voice_audits",
    "edge_metrics",
    "extension_dispatch_queue",
    "imported_contacts",
    "operators",
    "partners"
  ],
  "send-whatsapp": [
    "activities",
    "ai_routing_config",
    "app_settings",
    "brand_voice_audits",
    "channel_messages",
    "edge_metrics",
    "extension_dispatch_queue",
    "imported_contacts",
    "operators",
    "partners",
    "reminders"
  ],
  "sherlock-extract": [
    "ai_extract_cache",
    "edge_metrics"
  ],
  "simulate-funnemail-classify": [
    "edge_metrics",
    "email_sender_rules",
    "operative_prompts",
    "partners",
    "pipeline_traces"
  ],
  "smart-scheduler": [
    "ai_pending_actions",
    "edge_metrics",
    "imported_contacts",
    "profiles",
    "response_patterns",
    "supervisor_audit_log",
    "system_flags"
  ],
  "suggest-email-groups": [
    "channel_messages",
    "edge_metrics",
    "email_address_rules",
    "email_sender_groups",
    "operative_prompts"
  ],
  "super-mario": [
    "activities",
    "conversation_summaries",
    "edge_metrics",
    "operative_prompts",
    "partners",
    "super_mario_identities",
    "super_mario_invocations"
  ],
  "sync-business-cards": [
    "business_cards",
    "edge_metrics",
    "wca_business_cards"
  ],
  "sync-wca-partners": [
    "edge_metrics",
    "partner_contacts",
    "partner_networks",
    "partners",
    "wca_profiles"
  ],
  "tmwe-catalog-sync": [
    "tmwe_api_catalog",
    "tmwe_proxy_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-customer-sync": [
    "tmwe_customer_snapshot",
    "tmwe_partner_links",
    "tmwe_proxy_audit",
    "tmwe_request_audit",
    "tmwe_revenue_monthly",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-disconnect": [
    "tmwe_proxy_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-oauth-callback": [
    "edge_metrics",
    "operators",
    "profiles",
    "tmwe_oauth_state",
    "tmwe_proxy_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-oauth-start": [
    "tmwe_oauth_state",
    "tmwe_proxy_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-partner-link": [
    "tmwe_partner_links",
    "tmwe_proxy_audit",
    "tmwe_request_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-partner-match": [
    "partners",
    "tmwe_proxy_audit",
    "tmwe_request_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-proxy": [
    "tmwe_api_catalog",
    "tmwe_proxy_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "tmwe-quote-lookup": [
    "tmwe_customer_snapshot",
    "tmwe_partner_links",
    "tmwe_proxy_audit",
    "tmwe_request_audit",
    "tmwe_system_tokens",
    "tmwe_user_tokens"
  ],
  "translate-text": [
    "ai_routing_config",
    "edge_metrics"
  ],
  "tts": [
    "edge_metrics",
    "usage_daily_budget"
  ],
  "unified-assistant": [
    "edge_metrics"
  ],
  "voice-brain-bridge": [
    "ai_memory",
    "ai_request_log",
    "ai_routing_config",
    "app_settings",
    "bridge_tokens",
    "commercial_playbooks",
    "edge_metrics",
    "kb_entries",
    "partners",
    "request_logs",
    "voice_call_sessions"
  ],
  "wca-country-counts": [
    "edge_metrics",
    "wca_profiles"
  ],
  "whatsapp-ai-extract": [
    "edge_metrics"
  ]
} as const;

export const FN_CALLS: Readonly<Record<string, readonly string[]>> = {
  "agent-audit": [],
  "agent-autonomous-cycle": [
    "kb-supervisor"
  ],
  "agent-autopilot-worker": [
    "agent-execute"
  ],
  "agent-execute": [
    "ai-arena-suggest",
    "enrich-partner-website",
    "generate-aliases",
    "generate-outreach",
    "send-email"
  ],
  "agent-loop": [],
  "agent-prompt-refiner": [],
  "agent-simulate": [],
  "agent-task-drainer": [
    "agent-execute"
  ],
  "agentic-decide": [],
  "ai-arena-suggest": [],
  "ai-assistant": [
    "ai-arena-suggest",
    "enrich-partner-website",
    "generate-aliases",
    "generate-outreach",
    "kb-supervisor",
    "send-email"
  ],
  "ai-backup": [],
  "ai-deep-search-helper": [],
  "ai-gateway-micro": [],
  "ai-match-business-cards": [],
  "ai-monitor": [],
  "ai-query-planner": [],
  "ai-test-runner": [],
  "ai-tracking-healthcheck": [],
  "ai-utility": [],
  "analyze-email-edit": [],
  "analyze-import-structure": [],
  "analyze-partner": [],
  "apply-classification-insight": [],
  "apply-email-rules": [],
  "backfill-email-rules": [],
  "batch-enrichment-worker": [
    "enrich-partner-website"
  ],
  "browser-action": [],
  "cadence-engine": [
    "generate-outreach",
    "send-email"
  ],
  "calculate-lead-scores": [],
  "calculate-partner-quality": [],
  "categorize-content": [],
  "check-external-db": [],
  "check-inbox": [
    "apply-email-rules",
    "classify-inbound-message"
  ],
  "check-inbox-booking": [
    "apply-email-rules",
    "check-inbox",
    "classify-inbound-message"
  ],
  "classify-emails-batch": [
    "classify-inbound-message"
  ],
  "classify-inbound-content": [],
  "classify-inbound-message": [
    "classify-inbound-content",
    "dispatch-urgent-alert",
    "funnemail-auto-route",
    "funnemail-classify",
    "funnemail-policy-engine",
    "funnemail-policy-executor",
    "funnemail-scout-sender",
    "refresh-conversation-context"
  ],
  "command-ask-brain": [
    "ai-assistant"
  ],
  "confirm-injection-review": [],
  "consume-credits": [],
  "country-kb-generator": [],
  "daily-briefing": [],
  "decision-dashboard": [],
  "deduplicate-contacts": [],
  "deduplicate-partners": [],
  "dispatch-integrity-check": [],
  "dispatch-urgent-alert": [],
  "elevenlabs-agent-sync": [],
  "elevenlabs-conversation-token": [],
  "elevenlabs-tts": [],
  "email-cron-sync": [
    "check-inbox"
  ],
  "email-delivery-webhook": [],
  "email-imap-proxy": [],
  "email-sync-worker": [
    "check-inbox"
  ],
  "enrich-partner-website": [],
  "export-audit-csv": [],
  "finder-api-chat": [
    "tmwe-proxy"
  ],
  "funnemail-auto-route": [],
  "funnemail-backfill-inbound": [
    "funnemail-classify"
  ],
  "funnemail-classify": [],
  "funnemail-policy-engine": [],
  "funnemail-policy-executor": [],
  "funnemail-reminders-tick": [],
  "funnemail-scout-sender": [],
  "funnemail-send-autoresponder": [
    "send-email"
  ],
  "generate-aliases": [],
  "generate-content": [],
  "generate-email": [],
  "generate-outreach": [],
  "get-linkedin-credentials": [],
  "get-ra-credentials": [],
  "get-wca-credentials": [],
  "harmonize-proposal-chat": [],
  "health-check": [],
  "imap-list-folders": [],
  "improve-email": [],
  "install-vault-service-role-key": [],
  "kb-doctrine-audit": [],
  "kb-embed-backfill": [],
  "kb-index-map": [],
  "kb-ingest-document": [],
  "kb-intake-analyze": [],
  "kb-promoter": [],
  "kb-supervisor": [],
  "learn-from-group-correction": [],
  "linkedin-ai-extract": [],
  "linkedin-profile-api": [],
  "list-elevenlabs-voices": [],
  "log-action": [],
  "manage-email-folders": [],
  "mark-imap-seen": [],
  "mcp": [],
  "memory-embed-backfill": [],
  "memory-promoter": [],
  "mission-executor": [
    "generate-email",
    "generate-outreach"
  ],
  "optimus-analyze": [],
  "outreach-scheduler": [],
  "parse-business-card": [],
  "parse-profile-ai": [],
  "pending-action-executor": [
    "send-email"
  ],
  "process-ai-import": [],
  "process-download-job": [],
  "process-email-queue": [],
  "process-inbound-enrichment": [],
  "prompt-copilot-chat": [],
  "prompt-registry-drift-check": [],
  "prompt-test-runner": [],
  "recalculate-partner-quality": [],
  "receive-channel-message": [],
  "record-e2e-run": [],
  "refine-classification-rule": [],
  "refresh-conversation-context": [],
  "replay-domain-events": [],
  "response-pattern-aggregator": [],
  "review-message": [],
  "run-funnemail-eval": [],
  "save-correction-memory": [],
  "save-linkedin-cookie": [],
  "save-linkedin-credentials": [],
  "save-ra-cookie": [],
  "save-ra-prospects": [],
  "save-wca-contacts": [],
  "save-wca-cookie": [],
  "scrape-website": [],
  "send-email": [],
  "send-linkedin": [],
  "send-whatsapp": [],
  "sherlock-extract": [],
  "simulate-funnemail-classify": [],
  "smart-scheduler": [],
  "suggest-email-groups": [],
  "super-mario": [],
  "sync-business-cards": [],
  "sync-wca-partners": [],
  "tmwe-catalog-sync": [
    "tmwe-oauth-callback"
  ],
  "tmwe-customer-sync": [
    "tmwe-oauth-callback"
  ],
  "tmwe-disconnect": [
    "tmwe-oauth-callback"
  ],
  "tmwe-oauth-callback": [],
  "tmwe-oauth-start": [
    "tmwe-oauth-callback"
  ],
  "tmwe-partner-link": [
    "tmwe-customer-sync",
    "tmwe-oauth-callback"
  ],
  "tmwe-partner-match": [
    "tmwe-oauth-callback"
  ],
  "tmwe-proxy": [
    "tmwe-oauth-callback"
  ],
  "tmwe-quote-lookup": [
    "tmwe-oauth-callback"
  ],
  "translate-text": [],
  "tts": [],
  "unified-assistant": [],
  "voice-brain-bridge": [
    "unified-assistant"
  ],
  "wca-country-counts": [],
  "whatsapp-ai-extract": []
} as const;

export const PAGE_CALLS: Readonly<Record<string, readonly string[]>> = {
  "/v2/login": [
    "tmwe-customer-sync",
    "tmwe-disconnect",
    "tmwe-oauth-start",
    "tmwe-partner-link",
    "tmwe-partner-match",
    "tmwe-proxy",
    "tmwe-quote-lookup"
  ],
  "/v2/tmwe-login-popup": [
    "tmwe-customer-sync",
    "tmwe-disconnect",
    "tmwe-oauth-start",
    "tmwe-partner-link",
    "tmwe-partner-match",
    "tmwe-proxy",
    "tmwe-quote-lookup"
  ],
  "/v2/finder-api": [
    "command-ask-brain",
    "elevenlabs-conversation-token"
  ],
  "/v2/finder-api/schema": [
    "tmwe-catalog-sync",
    "tmwe-proxy"
  ],
  "/v2/command": [
    "browser-action",
    "command-ask-brain",
    "elevenlabs-conversation-token",
    "scrape-website"
  ],
  "/v2/command/help": [
    "browser-action",
    "scrape-website"
  ],
  "/v2/approvazioni": [
    "pending-action-executor"
  ],
  "/v2/ai-staff/kb-supervisor": [
    "elevenlabs-tts"
  ],
  "/v2/settings": [
    "save-linkedin-credentials"
  ],
  "/v2/tmwe/clients": [
    "tmwe-customer-sync",
    "tmwe-disconnect",
    "tmwe-oauth-start",
    "tmwe-partner-link",
    "tmwe-partner-match",
    "tmwe-proxy",
    "tmwe-quote-lookup"
  ]
} as const;
