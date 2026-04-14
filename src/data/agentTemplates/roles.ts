// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent Roles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AGENT_ROLES = [
  { value: "outreach", label: "Outreach", emoji: "📧", color: "text-blue-400" },
  { value: "sales", label: "Sales", emoji: "💰", color: "text-yellow-400" },
  { value: "download", label: "Download/Sync", emoji: "📥", color: "text-emerald-400" },
  { value: "research", label: "Ricerca", emoji: "🔍", color: "text-amber-400" },
  { value: "account", label: "Account Manager", emoji: "🤝", color: "text-purple-400" },
  { value: "strategy", label: "Strategia", emoji: "🧠", color: "text-rose-400" },
] as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Default ElevenLabs voices by gender
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AGENT_DEFAULT_VOICES: Record<string, { voiceId: string; voiceName: string }> = {
  male: { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel 🇬🇧" },
  female: { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah 🇺🇸" },
};

// Robin's voice call URL (designated phone agent)
export const ROBIN_VOICE_CALL_URL = "https://elevenlabs.io/app/talk-to?agent_id=robin";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full operational tool set (all agents get these)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ALL_OPERATIONAL_TOOLS: string[] = [
  // Partner
  "search_partners", "get_partner_detail", "update_partner", "add_partner_note",
  "manage_partner_contact", "bulk_update_partners",
  // Network
  "get_country_overview", "get_directory_status", "scan_directory", "create_download_job",
  "download_single_partner", "list_jobs", "check_job_status", "get_partners_without_contacts",
  // Ricerca
  "deep_search_partner", "deep_search_contact", "enrich_partner_website", "generate_aliases",
  // CRM
  "search_contacts", "get_contact_detail", "update_lead_status", "search_prospects",
  // Outreach
  "generate_outreach", "send_email", "schedule_email", "queue_outreach",
  // Agenda
  "create_activity", "list_activities", "update_activity",
  "create_reminder", "update_reminder", "list_reminders",
  // Sistema
  "check_blacklist", "get_global_summary", "save_memory", "search_memory",
  "delete_records", "search_business_cards", "execute_ui_action",
  "get_operations_dashboard",
  // Communication & Holding Pattern
  "get_inbox", "get_conversation_history", "get_holding_pattern",
  "update_message_status", "get_email_thread", "analyze_incoming_email",
];

// Management tools — only for Director (Luca)
const MANAGEMENT_TOOLS: string[] = [
  "create_agent_task", "list_agent_tasks", "get_team_status",
  "update_agent_prompt", "add_agent_kb_entry",
  // Director-only campaign tools
  "assign_contacts_to_agent", "create_campaign",
];

// Strategic tools — only for Director (Luca)
const STRATEGIC_TOOLS: string[] = [
  "create_work_plan", "list_work_plans", "update_work_plan",
  "manage_workspace_preset", "get_system_analytics",
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Default Knowledge Base per ruolo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
