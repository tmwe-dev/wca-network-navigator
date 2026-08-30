/** GENERATO da scripts/gen-galaxy-synapses.mjs — non modificare a mano. */
export const FN_TABLES: Readonly<Record<string, readonly string[]>> = {
  "agent-audit": [
    "agents"
  ],
  "agent-autonomous-cycle": [
    "activities",
    "agent_tasks",
    "agents",
    "app_settings",
    "channel_messages",
    "client_assignments",
    "partner_social_links",
    "partners"
  ],
  "agent-autopilot-worker": [
    "agent_mission_events",
    "agent_missions"
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
    "ai_work_plans",
    "app_settings",
    "blacklist",
    "business_cards",
    "channel_messages",
    "client_assignments",
    "contact_conversation_context",
    "contact_interactions",
    "directory_members",
    "download_job_items",
    "download_jobs",
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
    "workspace_presets"
  ],
  "agent-loop": [],
  "agent-prompt-refiner": [
    "agents",
    "ai_memory",
    "ai_pending_actions",
    "supervisor_audit_log"
  ],
  "agent-simulate": [],
  "agent-task-drainer": [
    "agent_tasks",
    "app_settings"
  ],
  "agentic-decide": [],
  "ai-arena-suggest": [
    "activities",
    "app_settings",
    "partner_contacts",
    "partners"
  ],
  "ai-assistant": [
    "agent_knowledge_links",
    "agents",
    "ai_memory",
    "ai_pending_actions",
    "ai_work_plans",
    "app_settings",
    "channel_messages",
    "contact_conversation_context",
    "directory_cache",
    "download_job_items",
    "download_jobs",
    "email_address_rules",
    "email_classifications",
    "import_logs",
    "imported_contacts",
    "kb_entries",
    "outreach_missions",
    "outreach_queue",
    "partner_certifications",
    "partner_services",
    "partner_workflow_state",
    "partners",
    "partners_no_contacts",
    "user_api_keys",
    "user_credits"
  ],
  "ai-backup": [
    "agent_personas",
    "ai_memory",
    "app_settings",
    "kb_entries",
    "operative_prompts",
    "profiles"
  ],
  "ai-deep-search-helper": [
    "app_settings"
  ],
  "ai-gateway-micro": [],
  "ai-match-business-cards": [
    "business_cards",
    "partners"
  ],
  "ai-monitor": [
    "ai_budget_config"
  ],
  "ai-query-planner": [],
  "ai-test-runner": [
    "ai_test_scenarios"
  ],
  "ai-tracking-healthcheck": [
    "ai_prompt_log"
  ],
  "ai-utility": [],
  "analyze-email-edit": [
    "app_settings"
  ],
  "analyze-import-structure": [],
  "analyze-partner": [
    "credit_transactions",
    "partner_services",
    "partners",
    "user_api_keys",
    "user_credits"
  ],
  "apply-classification-insight": [
    "ai_classification_insights",
    "email_sender_groups",
    "operative_prompts"
  ],
  "apply-email-rules": [
    "channel_messages",
    "email_address_rules"
  ],
  "backfill-email-rules": [
    "channel_messages",
    "email_address_rules"
  ],
  "batch-enrichment-worker": [
    "app_settings",
    "partners"
  ],
  "browser-action": [
    "browser_action_log"
  ],
  "cadence-engine": [
    "ai_decision_log",
    "ai_pending_actions",
    "app_settings",
    "contact_conversation_context",
    "email_address_rules",
    "email_classifications",
    "mission_actions"
  ],
  "calculate-lead-scores": [
    "business_cards",
    "contact_interactions",
    "imported_contacts"
  ],
  "calculate-partner-quality": [],
  "categorize-content": [],
  "check-external-db": [],
  "check-inbox": [
    "activities",
    "app_settings",
    "channel_messages",
    "email_address_rules",
    "email_attachments",
    "email_sync_state",
    "imported_contacts",
    "inbound_enrichment_queue",
    "operators",
    "partner_contacts",
    "partners",
    "prospects",
    "supervisor_audit_log"
  ],
  "check-inbox-booking": [
    "activities",
    "app_settings",
    "channel_messages",
    "email_address_rules",
    "email_attachments",
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
    "email_content_intelligence",
    "partner_outreach_state",
    "partners",
    "system_doctrine"
  ],
  "classify-inbound-message": [
    "activities",
    "ai_pending_actions",
    "outreach_missions",
    "reply_classifications"
  ],
  "command-ask-brain": [
    "bridge_tokens"
  ],
  "confirm-injection-review": [],
  "consume-credits": [
    "user_api_keys"
  ],
  "country-kb-generator": [
    "app_settings",
    "kb_entries",
    "partners"
  ],
  "daily-briefing": [
    "activities",
    "agent_tasks",
    "agents",
    "app_settings",
    "channel_messages",
    "download_jobs",
    "email_campaign_queue",
    "imported_contacts",
    "partners"
  ],
  "decision-dashboard": [
    "ai_pending_actions"
  ],
  "deduplicate-contacts": [
    "contact_interactions",
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
    "partners"
  ],
  "dispatch-urgent-alert": [
    "alert_dispatch_log",
    "alert_recipients",
    "extension_dispatch_queue"
  ],
  "elevenlabs-agent-sync": [
    "agents"
  ],
  "elevenlabs-conversation-token": [
    "agents",
    "bridge_tokens"
  ],
  "elevenlabs-tts": [
    "app_settings"
  ],
  "email-cron-sync": [
    "email_sync_state",
    "operator_mailbox_access",
    "operators",
    "profiles",
    "shared_mailboxes"
  ],
  "email-delivery-webhook": [
    "email_delivery_events"
  ],
  "email-imap-proxy": [],
  "email-sync-worker": [
    "email_sync_jobs"
  ],
  "enrich-partner-website": [
    "ai_extract_cache",
    "app_settings",
    "partners",
    "scrape_cache"
  ],
  "export-audit-csv": [
    "agent_action_log"
  ],
  "finder-api-chat": [
    "finder_api_kb",
    "finder_api_schema_map",
    "tmwe_api_catalog"
  ],
  "funnemail-auto-route": [
    "channel_messages",
    "email_address_rules",
    "email_sender_groups",
    "funnemail_routing_config",
    "funnemail_routing_rules"
  ],
  "funnemail-backfill-inbound": [
    "channel_messages",
    "email_address_rules",
    "email_sender_groups",
    "funnemail_decisions"
  ],
  "funnemail-classify": [
    "funnemail_decisions",
    "funnemail_folders"
  ],
  "funnemail-policy-engine": [
    "email_address_rules",
    "email_sender_groups"
  ],
  "funnemail-policy-executor": [
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
    "funnemail_autoresponder_log",
    "funnemail_autoresponder_templates"
  ],
  "generate-aliases": [
    "imported_contacts",
    "partner_contacts",
    "partners"
  ],
  "generate-content": [],
  "generate-email": [
    "activities",
    "ai_edit_patterns",
    "ai_memory",
    "app_settings",
    "business_cards",
    "contact_conversation_context",
    "email_address_rules",
    "email_classifications",
    "imported_contacts",
    "interactions",
    "kb_entries",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partner_social_links",
    "partners",
    "prospect_contacts",
    "prospects",
    "response_patterns",
    "suggested_improvements",
    "system_doctrine",
    "workspace_documents"
  ],
  "generate-outreach": [
    "activities",
    "app_settings",
    "business_cards",
    "channel_messages",
    "contact_conversation_context",
    "email_address_rules",
    "email_classifications",
    "imported_contacts",
    "interactions",
    "kb_entries",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partners"
  ],
  "get-linkedin-credentials": [
    "app_settings"
  ],
  "get-ra-credentials": [
    "app_settings"
  ],
  "get-wca-credentials": [
    "user_wca_credentials"
  ],
  "harmonize-proposal-chat": [
    "agents",
    "harmonize_runs",
    "kb_entries"
  ],
  "health-check": [
    "agents",
    "ai_pending_actions",
    "reply_classifications"
  ],
  "imap-list-folders": [],
  "improve-email": [
    "activities",
    "app_settings",
    "kb_entries",
    "partner_contacts",
    "partner_workflow_state",
    "partners",
    "suggested_improvements"
  ],
  "install-vault-service-role-key": [],
  "kb-doctrine-audit": [
    "kb_audit_reports",
    "kb_entries"
  ],
  "kb-embed-backfill": [
    "kb_entries"
  ],
  "kb-index-map": [
    "kb_entries"
  ],
  "kb-ingest-document": [
    "kb_entries"
  ],
  "kb-intake-analyze": [
    "kb_entries"
  ],
  "kb-promoter": [
    "kb_entries"
  ],
  "kb-supervisor": [
    "activities",
    "commercial_playbooks",
    "kb_entries"
  ],
  "learn-from-group-correction": [
    "ai_decision_log",
    "channel_messages",
    "email_address_rules",
    "kb_entries"
  ],
  "linkedin-ai-extract": [],
  "linkedin-profile-api": [],
  "list-elevenlabs-voices": [],
  "log-action": [],
  "manage-email-folders": [
    "channel_messages"
  ],
  "mark-imap-seen": [
    "channel_messages"
  ],
  "mcp": [
    "agents",
    "partners"
  ],
  "memory-embed-backfill": [
    "ai_memory"
  ],
  "memory-promoter": [
    "ai_decision_log",
    "ai_memory",
    "email_address_rules"
  ],
  "mission-executor": [
    "mission_actions",
    "mission_slot_config",
    "outreach_missions"
  ],
  "optimus-analyze": [
    "operators",
    "scraper_agent_log",
    "scraper_agent_memory"
  ],
  "outreach-scheduler": [
    "activities",
    "channel_messages",
    "imported_contacts",
    "mission_actions",
    "outreach_missions",
    "outreach_schedules"
  ],
  "parse-business-card": [],
  "parse-profile-ai": [
    "partner_certifications",
    "partner_contacts",
    "partner_networks",
    "partners"
  ],
  "pending-action-executor": [
    "activities",
    "ai_pending_actions",
    "app_settings",
    "email_address_rules",
    "outreach_schedules",
    "partners"
  ],
  "process-ai-import": [
    "import_errors",
    "import_logs",
    "imported_contacts"
  ],
  "process-download-job": [
    "directory_cache",
    "download_jobs",
    "network_configs",
    "partner_contacts",
    "partner_networks",
    "partners"
  ],
  "process-email-queue": [
    "app_settings",
    "email_campaign_queue",
    "email_drafts",
    "email_send_log",
    "partners"
  ],
  "process-inbound-enrichment": [
    "channel_messages",
    "inbound_enrichment_queue"
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
    "kb_entries",
    "operative_prompts",
    "prompt_test_cases",
    "prompt_test_runs",
    "prompt_versions"
  ],
  "recalculate-partner-quality": [
    "partners"
  ],
  "receive-channel-message": [
    "channel_messages",
    "extension_dispatch_queue",
    "operators"
  ],
  "record-e2e-run": [
    "e2e_run_results"
  ],
  "refine-classification-rule": [
    "ai_classification_insights",
    "channel_messages",
    "email_address_rules",
    "email_sender_groups",
    "operative_prompts"
  ],
  "refresh-conversation-context": [
    "channel_messages",
    "contact_conversation_context",
    "partners"
  ],
  "replay-domain-events": [
    "domain_events"
  ],
  "response-pattern-aggregator": [
    "activities",
    "kb_entries",
    "partners",
    "response_patterns"
  ],
  "review-message": [
    "imported_contacts",
    "partners"
  ],
  "run-funnemail-eval": [
    "funnemail_eval_cases",
    "funnemail_eval_runs"
  ],
  "save-correction-memory": [
    "ai_memory",
    "email_address_rules",
    "supervisor_audit_log"
  ],
  "save-linkedin-cookie": [
    "app_settings",
    "user_linkedin_sessions"
  ],
  "save-linkedin-credentials": [
    "app_settings"
  ],
  "save-ra-cookie": [
    "app_settings",
    "user_ra_sessions"
  ],
  "save-ra-prospects": [
    "prospect_contacts",
    "prospects"
  ],
  "save-wca-contacts": [
    "partner_certifications",
    "partner_contacts",
    "partner_networks",
    "partner_services",
    "partners"
  ],
  "save-wca-cookie": [
    "app_settings",
    "user_wca_sessions"
  ],
  "scrape-website": [
    "scrape_cache"
  ],
  "send-email": [
    "agents",
    "app_settings",
    "blacklist",
    "email_campaign_queue",
    "email_send_log",
    "imported_contacts",
    "operators",
    "partners"
  ],
  "send-linkedin": [
    "extension_dispatch_queue",
    "imported_contacts",
    "operators",
    "partners"
  ],
  "send-whatsapp": [
    "activities",
    "channel_messages",
    "extension_dispatch_queue",
    "imported_contacts",
    "operators",
    "partners",
    "reminders"
  ],
  "sherlock-extract": [
    "ai_extract_cache"
  ],
  "simulate-funnemail-classify": [
    "email_sender_rules",
    "partners"
  ],
  "smart-scheduler": [
    "ai_pending_actions",
    "imported_contacts",
    "profiles",
    "response_patterns",
    "supervisor_audit_log"
  ],
  "suggest-email-groups": [
    "channel_messages",
    "email_address_rules",
    "email_sender_groups"
  ],
  "super-mario": [
    "activities",
    "conversation_summaries",
    "operative_prompts",
    "partners",
    "super_mario_identities",
    "super_mario_invocations"
  ],
  "sync-business-cards": [
    "business_cards",
    "wca_business_cards"
  ],
  "sync-wca-partners": [
    "partner_contacts",
    "partner_networks",
    "partners",
    "wca_profiles"
  ],
  "tmwe-catalog-sync": [
    "tmwe_api_catalog"
  ],
  "tmwe-customer-sync": [
    "tmwe_customer_snapshot",
    "tmwe_partner_links",
    "tmwe_revenue_monthly"
  ],
  "tmwe-disconnect": [
    "tmwe_user_tokens"
  ],
  "tmwe-oauth-callback": [
    "operators",
    "profiles",
    "tmwe_oauth_state",
    "tmwe_user_tokens"
  ],
  "tmwe-oauth-start": [
    "tmwe_oauth_state"
  ],
  "tmwe-partner-link": [
    "tmwe_partner_links"
  ],
  "tmwe-partner-match": [
    "partners"
  ],
  "tmwe-proxy": [
    "tmwe_api_catalog",
    "tmwe_user_tokens"
  ],
  "tmwe-quote-lookup": [
    "tmwe_customer_snapshot",
    "tmwe_partner_links"
  ],
  "translate-text": [],
  "tts": [],
  "unified-assistant": [],
  "voice-brain-bridge": [
    "ai_memory",
    "ai_request_log",
    "app_settings",
    "bridge_tokens",
    "commercial_playbooks",
    "kb_entries",
    "partners",
    "request_logs",
    "voice_call_sessions"
  ],
  "wca-country-counts": [
    "wca_profiles"
  ],
  "whatsapp-ai-extract": []
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
    "kb-supervisor"
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
  "check-inbox": [],
  "check-inbox-booking": [
    "check-inbox"
  ],
  "classify-emails-batch": [
    "classify-inbound-message"
  ],
  "classify-inbound-content": [],
  "classify-inbound-message": [
    "classify-inbound-content",
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
  "tmwe-catalog-sync": [],
  "tmwe-customer-sync": [],
  "tmwe-disconnect": [],
  "tmwe-oauth-callback": [],
  "tmwe-oauth-start": [],
  "tmwe-partner-link": [
    "tmwe-customer-sync"
  ],
  "tmwe-partner-match": [],
  "tmwe-proxy": [],
  "tmwe-quote-lookup": [],
  "translate-text": [],
  "tts": [],
  "unified-assistant": [],
  "voice-brain-bridge": [
    "unified-assistant"
  ],
  "wca-country-counts": [],
  "whatsapp-ai-extract": []
} as const;

export const PAGE_CALLS: Readonly<Record<string, readonly string[]>> = {} as const;
