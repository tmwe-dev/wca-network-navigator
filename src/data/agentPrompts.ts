/**
 * Registro Metadati Agenti AI
 *
 * Espone:
 *  - AGENT_REGISTRY: registro esteso (runtime, contratti, prompt sources, KB, tools)
 *    usato da Agent Atlas (/v2/prompt-lab/atlas) e dal Lab Agent in modalità Architect.
 *  - AGENT_PROMPTS: vista compatibile per documentazione (AIExportPanel).
 *
 * NOTE — DEBITO TECNICO NOTO (v1):
 * Questo registro è MANUALE. Quando aggiungi una nuova edge function che esegue
 * un prompt LLM o un nuovo agente conversazionale, AGGIORNA QUI manualmente.
 * Esiste un test guard (src/v2/test/agentRegistry.test.ts) che fallisce se trova
 * directory in supabase/functions/ etichettate come "agent" non mappate qui.
 */

/** Categoria funzionale dell'agente (drives sidebar grouping in Atlas). */
export type AgentCategory =
  | "conversational"
  | "generative"
  | "classification"
  | "reviewer"
  | "scraper"
  | "voice"
  | "worker"
  | "strategy";

/** Sorgente di un blocco prompt visualizzato in Atlas (mirror BlockSource del Prompt Lab). */
export interface AgentPromptSourceRef {
  promptLabTab:
    | "system_prompt"
    | "kb_doctrine"
    | "operative"
    | "email"
    | "voice"
    | "playbooks"
    | "personas"
    | "ai_profile"
    | "journalists"
    | "operative_kb"
    | "administrative_kb"
    | "support_kb"
    | "domain_routing";
  label: string;
  source: string;
  hint?: string;
}

export interface AgentRuntime {
  edgeFunction: string;
  modelDefault: string;
  triggers: string[];
}

export interface AgentContract {
  input: string;
  output: string;
}

export interface AgentRegistryEntry {
  id: string;
  displayName: string;
  category: AgentCategory;
  coreFile: string;
  kbCategories: string[];
  criticalProcedures: string[];
  requiredVars: string[];
  description: string;
  runtime: AgentRuntime;
  contract: AgentContract;
  tools: string[];
  promptSources: AgentPromptSourceRef[];
  avatarIcon: string;
  avatarColor: "primary" | "secondary" | "accent" | "muted" | "destructive";
}

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
  // ───────────────────── CONVERSATIONAL ─────────────────────
  "luca": {
    id: "luca",
    displayName: "Luca — Director",
    category: "conversational",
    coreFile: "core/luca",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "doctrine/safety-guardrails",
      "doctrine/anti-hallucination",
      "doctrine/data-availability",
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Uscite",
    ],
    requiredVars: ["user_alias", "user_company", "user_sector"],
    description: "Director strategico, segretario operativo dell'Operations Center.",
    runtime: {
      edgeFunction: "unified-assistant",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Command Center chat", "AI Assistant overlay", "voice-brain-bridge"],
    },
    contract: {
      input: "{ scope: 'command' | 'strategic', messages: ChatMessage[], context: { currentPage, contacts? } }",
      output: "{ content: string, structured?: { actions: Action[], plan?: Plan } }",
    },
    tools: ["search_partner", "list_contacts", "create_activity", "schedule_call", "send_email"],
    promptSources: [
      { promptLabTab: "system_prompt", label: "System Prompt blocks (8 blocchi LUCA)", source: "app_settings.system_prompt_blocks" },
      { promptLabTab: "kb_doctrine", label: "Doctrine + system_doctrine + sales_doctrine", source: "kb_entries (assembler)" },
      { promptLabTab: "ai_profile", label: "Company profile (alias, sector, tone)", source: "app_settings.ai_*" },
    ],
    avatarIcon: "Compass",
    avatarColor: "primary",
  },

  "super-assistant": {
    id: "super-assistant",
    displayName: "Super Assistant",
    category: "conversational",
    coreFile: "core/super-assistant",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "doctrine/anti-hallucination",
      "doctrine/data-availability",
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Multi-Canale",
      "Progressione Relazionale",
    ],
    requiredVars: ["user_alias"],
    description: "Super Consulente Strategico per pianificazione e Daily Plan.",
    runtime: {
      edgeFunction: "unified-assistant",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Daily Plan", "Strategic chat scope"],
    },
    contract: {
      input: "{ scope: 'strategic', messages, context }",
      output: "{ content, structured?: { recommendations: Recommendation[] } }",
    },
    tools: ["search_partner", "list_contacts", "create_mission", "analyze_pipeline"],
    promptSources: [
      { promptLabTab: "system_prompt", label: "System Prompt globale", source: "app_settings.system_prompt_blocks" },
      { promptLabTab: "kb_doctrine", label: "Sales doctrine + procedures", source: "kb_entries" },
    ],
    avatarIcon: "Brain",
    avatarColor: "primary",
  },

  "contacts-assistant": {
    id: "contacts-assistant",
    displayName: "Contacts Assistant",
    category: "conversational",
    coreFile: "core/contacts-assistant",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "procedures/ai-query-engine",
      "doctrine/data-availability",
      "procedures/lead-qualification-v2",
    ],
    requiredVars: [],
    description: "Assistente maschera contatti, opera su imported_contacts.",
    runtime: {
      edgeFunction: "unified-assistant",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["Contacts page chat", "IntelliFlow overlay"],
    },
    contract: {
      input: "{ scope: 'contacts', messages, context: { contactIds[]? } }",
      output: "{ content, structured?: { contactActions: Action[] } }",
    },
    tools: ["update_contact", "merge_contacts", "enrich_contact", "create_activity"],
    promptSources: [
      { promptLabTab: "system_prompt", label: "System Prompt globale", source: "app_settings.system_prompt_blocks" },
      { promptLabTab: "kb_doctrine", label: "Procedure ai-query-engine, lead-qualification", source: "kb_entries" },
    ],
    avatarIcon: "Users",
    avatarColor: "secondary",
  },

  "cockpit-assistant": {
    id: "cockpit-assistant",
    displayName: "Cockpit Assistant",
    category: "conversational",
    coreFile: "core/cockpit-assistant",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "doctrine/data-availability",
      "procedures/email-single",
      "procedures/whatsapp-message",
      "procedures/multi-channel-sequence",
      "procedures/post-send-checklist",
      "Dottrina Multi-Canale",
    ],
    requiredVars: [],
    description: "Command Bar del Cockpit outreach, output JSON strutturato.",
    runtime: {
      edgeFunction: "unified-assistant",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["Cockpit Command Bar", "IntelliFlow overlay (cockpit_assistant)"],
    },
    contract: {
      input: "{ scope: 'cockpit', command: string, contacts: ContactRef[] }",
      output: "{ actions: Action[] } (JSON only, no prose)",
    },
    tools: ["send_email", "send_whatsapp", "send_linkedin", "schedule_followup", "skip_contact"],
    promptSources: [
      { promptLabTab: "system_prompt", label: "System Prompt globale", source: "app_settings.system_prompt_blocks" },
      { promptLabTab: "kb_doctrine", label: "Procedure email/WA/multi-channel", source: "kb_entries" },
      { promptLabTab: "operative", label: "Operative prompts (procedure step)", source: "operative_prompts" },
    ],
    avatarIcon: "LayoutDashboard",
    avatarColor: "accent",
  },

  // ───────────────────── GENERATIVE ─────────────────────
  "email-improver": {
    id: "email-improver",
    displayName: "Email Improver",
    category: "generative",
    coreFile: "core/email-improver",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "procedures/email-improvement-techniques",
      "§1 Filosofia di vendita",
      "§4 Cold Outreach",
      "§10 Tono e registro",
    ],
    requiredVars: ["user_alias", "user_company", "user_tone"],
    description: "Copywriter B2B che migliora email mantenendo voce dell'autore.",
    runtime: {
      edgeFunction: "improve-email",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Email Composer 'Migliora'", "Pre-send guard"],
    },
    contract: {
      input: "{ original_text, recipient_context, tone_target?, channel: 'email' }",
      output: "{ improved_text, change_log: string[], coherence_score: 0..1 }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "email", label: "Email global prompts", source: "email_prompts (scope=global)" },
      { promptLabTab: "personas", label: "Persona attiva (tone, vocabulary)", source: "agent_personas" },
      { promptLabTab: "kb_doctrine", label: "Tone-and-format, cold outreach", source: "kb_entries" },
    ],
    avatarIcon: "Wand2",
    avatarColor: "secondary",
  },

  "generate-email": {
    id: "generate-email",
    displayName: "Generate Email — Editor Giornalista",
    category: "generative",
    coreFile: "",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine"],
    criticalProcedures: ["procedures/email-single", "Dottrina Uscite"],
    requiredVars: ["partner_dossier"],
    description: "Compone un'email B2B per UN destinatario partendo da dossier completo.",
    runtime: {
      edgeFunction: "generate-email",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Email Composer 'Genera'", "Outreach plan executor"],
    },
    contract: {
      input: "{ partner_id, dossier, email_type, address_rule_id?, _system_prompt_override?, _user_prompt_override? }",
      output: "{ subject, body_html, body_text, used_blocks: string[] }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "email", label: "Email types (global prompts per tipo)", source: "app_settings.email_oracle_types" },
      { promptLabTab: "email", label: "Email address rules (custom_prompt)", source: "email_address_rules" },
      { promptLabTab: "personas", label: "Persona del mittente", source: "agent_personas" },
      { promptLabTab: "ai_profile", label: "Identità WCA + sector", source: "app_settings.ai_*" },
    ],
    avatarIcon: "Mail",
    avatarColor: "secondary",
  },

  "generate-outreach": {
    id: "generate-outreach",
    displayName: "Generate Outreach (multi-channel)",
    category: "generative",
    coreFile: "",
    kbCategories: ["doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: ["procedures/multi-channel-sequence", "Dottrina Multi-Canale"],
    requiredVars: [],
    description: "Genera messaggi outreach calibrati per canale (email/WA/LI) e channel-aware.",
    runtime: {
      edgeFunction: "generate-outreach",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Outreach planner", "Cadence engine"],
    },
    contract: {
      input: "{ partner_id, channel: 'email'|'whatsapp'|'linkedin', stage, prior_messages?, address_rule? }",
      output: "{ message: string, subject?: string, follow_up_suggestion? }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "email", label: "Email global prompts + address rules", source: "email_prompts + email_address_rules" },
      { promptLabTab: "playbooks", label: "Playbook commerciale attivo", source: "commercial_playbooks" },
      { promptLabTab: "personas", label: "Persona mittente", source: "agent_personas" },
    ],
    avatarIcon: "Send",
    avatarColor: "secondary",
  },

  "daily-briefing": {
    id: "daily-briefing",
    displayName: "Daily Briefing",
    category: "generative",
    coreFile: "core/daily-briefing",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Workflow Gate",
    ],
    requiredVars: [],
    description: "Direttore operativo che genera briefing mattutino JSON.",
    runtime: {
      edgeFunction: "daily-briefing",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["pg_cron daily 07:00", "Manual refresh briefing widget"],
    },
    contract: {
      input: "{ user_id, timezone, date }",
      output: "{ priorities: Item[], holding_alerts: Item[], suggested_actions: Action[] }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "system_prompt", label: "System Prompt globale", source: "app_settings.system_prompt_blocks" },
      { promptLabTab: "kb_doctrine", label: "Holding Pattern + Workflow Gate", source: "kb_entries" },
    ],
    avatarIcon: "Sunrise",
    avatarColor: "secondary",
  },

  // ───────────────────── CLASSIFICATION ─────────────────────
  "email-classifier": {
    id: "email-classifier",
    displayName: "Email Classifier (domain-aware)",
    category: "classification",
    coreFile: "core/email-classifier",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures", "domain_routing"],
    criticalProcedures: [
      "procedures/lead-qualification-v2",
      "Dottrina Uscite",
      "Regole smistamento per dominio",
    ],
    requiredVars: [],
    description: "Classificatore risposte inbound multicanale con domain routing.",
    runtime: {
      edgeFunction: "classify-email-response",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["Inbox processor (per nuovo messaggio inbound)"],
    },
    contract: {
      input: "{ message_id, body, sender, prior_thread? }",
      output: "{ intent, sentiment, domain: 'operative'|'administrative'|'support', next_status, suggested_action }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "domain_routing", label: "Regole smistamento dominio", source: "kb_entries (domain_routing)" },
      { promptLabTab: "operative_kb", label: "KB procedure operative", source: "kb_entries (operative)" },
      { promptLabTab: "administrative_kb", label: "KB procedure amministrative", source: "kb_entries (administrative)" },
      { promptLabTab: "support_kb", label: "KB procedure supporto", source: "kb_entries (support)" },
    ],
    avatarIcon: "Filter",
    avatarColor: "muted",
  },

  "classify-inbound-message": {
    id: "classify-inbound-message",
    displayName: "Classify Inbound Message",
    category: "classification",
    coreFile: "",
    kbCategories: ["procedures"],
    criticalProcedures: ["procedures/inbound-classification"],
    requiredVars: [],
    description: "Classificatore generico messaggi inbound (email/WA/LI) con channel hint.",
    runtime: {
      edgeFunction: "classify-inbound-message",
      modelDefault: "google/gemini-2.5-flash-lite",
      triggers: ["Receive channel message", "Reply tracker universal"],
    },
    contract: {
      input: "{ message, channel: 'email'|'whatsapp'|'linkedin' }",
      output: "{ category, urgency, requires_human: boolean }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "kb_doctrine", label: "Procedure classificazione", source: "kb_entries" },
    ],
    avatarIcon: "Inbox",
    avatarColor: "muted",
  },

  "reply-classifier": {
    id: "reply-classifier",
    displayName: "Reply Classifier",
    category: "classification",
    coreFile: "",
    kbCategories: ["sales_doctrine", "procedures"],
    criticalProcedures: ["procedures/lead-qualification-v2"],
    requiredVars: [],
    description: "Driver dello stato lead: classifica risposte e fa avanzare la macchina a stati.",
    runtime: {
      edgeFunction: "reply-classifier",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["Reply tracker universal", "Cadence engine on inbound"],
    },
    contract: {
      input: "{ message, contact_id, current_status }",
      output: "{ new_status, confidence: 0..1, reasoning }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "kb_doctrine", label: "Sales doctrine — 9 stati lead", source: "kb_entries" },
    ],
    avatarIcon: "GitBranch",
    avatarColor: "muted",
  },

  // ───────────────────── REVIEWER ─────────────────────
  "journalists": {
    id: "journalists",
    displayName: "Giornalisti AI (Optimus review layer)",
    category: "reviewer",
    coreFile: "",
    kbCategories: ["doctrine", "sales_doctrine"],
    criticalProcedures: ["doctrine/tone-and-format", "§10 Tono e registro"],
    requiredVars: [],
    description: "Caporedattore finale: review post-generazione su email e messaggi outbound. Toggle Optimus 3 modalità.",
    runtime: {
      edgeFunction: "_shared/journalistReviewLayer",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["generate-email post-hook", "improve-email post-hook", "send_email guard", "send_whatsapp guard"],
    },
    contract: {
      input: "{ generated_text, channel, lead_status, mode: 'review_and_correct'|'review_only'|'silent_audit' }",
      output: "{ approved: boolean, corrected_text?, issues: Issue[], strictness_applied: 1..10 }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "journalists", label: "Caporedattore prompt + auto-selezione lead_status", source: "kb_entries (journalist_*)" },
      { promptLabTab: "ai_profile", label: "Settings Optimus (toggle, mode, strictness)", source: "app_settings.journalist_optimus_*" },
    ],
    avatarIcon: "Eye",
    avatarColor: "destructive",
  },

  // ───────────────────── SCRAPER ─────────────────────
  "optimus-scraper": {
    id: "optimus-scraper",
    displayName: "Optimus Scraper (DOM analyzer)",
    category: "scraper",
    coreFile: "",
    kbCategories: [],
    criticalProcedures: [],
    requiredVars: [],
    description: "Analizza DOM di pagine WhatsApp/LinkedIn e genera piani di estrazione cachati per (operator, channel, page_type, dom_hash).",
    runtime: {
      edgeFunction: "optimus-analyze",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["Browser extension WhatsApp", "Browser extension LinkedIn", "Manual re-analyze"],
    },
    contract: {
      input: "{ channel: 'whatsapp'|'linkedin', page_type: 'sidebar'|'thread'|'profile', dom_hash, dom_snippet, previous_plan? }",
      output: "{ plan: { selectors: Record<string,string>, confidence: 0..1, plan_version: number } }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "operative", label: "Channel guidance (whatsapp/sidebar, linkedin/thread, …)", source: "supabase/functions/optimus-analyze (in-code)" },
    ],
    avatarIcon: "ScanSearch",
    avatarColor: "accent",
  },

  // ───────────────────── VOICE ─────────────────────
  "voice-elevenlabs": {
    id: "voice-elevenlabs",
    displayName: "Voice Agents (Aurora / Bruce / Robin)",
    category: "voice",
    coreFile: "",
    kbCategories: ["doctrine", "sales_doctrine"],
    criticalProcedures: ["procedures/voice-end-call", "Dottrina Multi-Canale"],
    requiredVars: ["agent_voice_id"],
    description: "Agenti vocali ElevenLabs per chiamate inbound/outbound. Prompt strutturato in 8 sezioni.",
    runtime: {
      edgeFunction: "voice-brain-bridge",
      modelDefault: "elevenlabs-conversational-ai",
      triggers: ["ElevenLabs conversation token", "Voice presence overlay"],
    },
    contract: {
      input: "{ agent_id, conversation_id, user_speech, context }",
      output: "{ assistant_speech, tool_calls?: ToolCall[] }",
    },
    tools: ["end_call", "transfer_to_human", "lookup_partner", "schedule_followup"],
    promptSources: [
      { promptLabTab: "voice", label: "Prompt vocale ElevenLabs (8 sezioni canoniche)", source: "agents.system_prompt + voice template KB" },
      { promptLabTab: "personas", label: "Persona vocale (tono, signature)", source: "agent_personas" },
      { promptLabTab: "kb_doctrine", label: "Templates voce (Aurora/Bruce/Robin)", source: "kb_entries (category=prompt_template, tag=voice_template)" },
    ],
    avatarIcon: "Mic",
    avatarColor: "primary",
  },

  // ───────────────────── WORKER ─────────────────────
  "agent-execute": {
    id: "agent-execute",
    displayName: "Agent Execute (operational agents)",
    category: "worker",
    coreFile: "",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: ["doctrine/safety-guardrails", "LEGGE FONDAMENTALE — Holding Pattern"],
    requiredVars: ["agent_id"],
    description: "Esecutore agenti operativi (autopilot, missioni). Assembla system prompt da agents.system_prompt + persona + KB.",
    runtime: {
      edgeFunction: "agent-execute",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Agent autopilot worker", "Mission executor", "Manual agent run"],
    },
    contract: {
      input: "{ agent_id, mission_id?, goal, available_tools[] }",
      output: "{ steps: Step[], next_action, completed: boolean }",
    },
    tools: ["search_partner", "send_email", "send_whatsapp", "create_activity", "deep_search_contact"],
    promptSources: [
      { promptLabTab: "system_prompt", label: "System Prompt globale", source: "app_settings.system_prompt_blocks" },
      { promptLabTab: "personas", label: "Persona dell'agente", source: "agent_personas" },
      { promptLabTab: "playbooks", label: "Playbook strategico", source: "commercial_playbooks" },
    ],
    avatarIcon: "Cpu",
    avatarColor: "accent",
  },

  "mission-executor": {
    id: "mission-executor",
    displayName: "Mission Executor",
    category: "worker",
    coreFile: "",
    kbCategories: ["procedures", "sales_doctrine"],
    criticalProcedures: ["procedures/mission-execution", "Dottrina Workflow Gate"],
    requiredVars: ["mission_id"],
    description: "Orchestratore di missioni multi-step con KPI tracking.",
    runtime: {
      edgeFunction: "mission-executor",
      modelDefault: "google/gemini-2.5-pro",
      triggers: ["Mission flow start", "pg_cron mission scheduler"],
    },
    contract: {
      input: "{ mission_id, kpi_targets, deadline }",
      output: "{ progress: 0..1, completed_steps[], next_step, blockers[] }",
    },
    tools: ["agent-execute", "schedule_call", "send_email"],
    promptSources: [
      { promptLabTab: "playbooks", label: "Playbook collegato alla missione", source: "commercial_playbooks" },
      { promptLabTab: "kb_doctrine", label: "Procedure mission-execution", source: "kb_entries" },
    ],
    avatarIcon: "Target",
    avatarColor: "accent",
  },

  // ───────────────────── STRATEGY (prompt-only "virtual agents") ─────────────────────
  "query-planner": {
    id: "query-planner",
    displayName: "Query Planner",
    category: "worker",
    coreFile: "core/query-planner",
    kbCategories: ["doctrine", "procedures"],
    criticalProcedures: ["procedures/ai-query-engine"],
    requiredVars: [],
    description: "Pianificatore query SELECT sicure, mai esegue.",
    runtime: {
      edgeFunction: "ai-query-planner",
      modelDefault: "google/gemini-2.5-flash",
      triggers: ["Contacts assistant", "Deep search"],
    },
    contract: {
      input: "{ natural_query, available_tables[] }",
      output: "{ sql: string (SELECT only), explain, safety_check: 'pass'|'fail' }",
    },
    tools: [],
    promptSources: [
      { promptLabTab: "kb_doctrine", label: "Procedure ai-query-engine", source: "kb_entries" },
    ],
    avatarIcon: "Database",
    avatarColor: "muted",
  },
};

/* ─── Vista compatibile per documentazione (AIExportPanel) ─── */

interface AgentPromptSection {
  role: string;
  rules: string[];
  outputFormat?: string;
  contextInjection?: string[];
}

export const AGENT_PROMPTS: Record<string, AgentPromptSection> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([key, meta]) => [
    key,
    {
      role: meta.description,
      rules: [
        meta.coreFile
          ? `Core prompt: src/v2/agent/prompts/${meta.coreFile}.ts`
          : `Edge function: supabase/functions/${meta.runtime.edgeFunction}/`,
        `KB categories: ${meta.kbCategories.join(", ") || "(none)"}`,
        meta.criticalProcedures.length > 0
          ? `Procedure critiche iniettate: ${meta.criticalProcedures.join(", ")}`
          : "Nessuna procedura critica iniettata (solo indice KB)",
        meta.requiredVars.length > 0
          ? `Variabili richieste: ${meta.requiredVars.join(", ")}`
          : "Nessuna variabile obbligatoria",
        `Runtime: ${meta.runtime.edgeFunction} (${meta.runtime.modelDefault})`,
      ],
      outputFormat: meta.contract.output,
      contextInjection: [...meta.kbCategories, ...meta.criticalProcedures],
    },
  ]),
);
