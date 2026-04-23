/**
 * Registro Metadati Agenti AI
 *
 * Espone:
 *  - AGENT_REGISTRY  → mappa completa per Agent Atlas (brain map)
 *  - AGENT_PROMPTS   → vista compatta per documentazione (AIExportPanel)
 *  - AgentRegistryEntry, AgentCategory → tipi esportati
 */

/* ─── Types ─── */

export type AgentCategory =
  | "core"
  | "email"
  | "outreach"
  | "analysis"
  | "voice"
  | "autonomous"
  | "classifier";

export type AgentRole =
  | "oracolo"
  | "genera"
  | "migliora"
  | "giornalista"
  | "voce"
  | "codice"
  | "worker"
  | "classifier";

export interface PromptSource {
  label: string;
  source: string;
  promptLabTab: string;
  hint?: string;
}

export interface AgentRegistryEntry {
  id: string;
  displayName: string;
  description: string;
  coreFile: string;

  /* Visual */
  avatarIcon: string;          // lucide-react icon name
  avatarColor: "primary" | "secondary" | "accent" | "muted" | "destructive";

  /* Classification */
  category: AgentCategory;
  roleInModel: AgentRole;

  /* Knowledge */
  kbCategories: string[];
  criticalProcedures: string[];
  requiredVars: string[];
  promptSources: PromptSource[];

  /* Runtime */
  runtime: {
    edgeFunction: string;
    modelDefault: string;
    triggers: string[];
  };

  /* Tools */
  tools: string[];
  approvalRequiredTools: string[];
  dependsOn: string[];

  /* Contract I/O */
  contract: {
    input: string;
    output: string;
  };
}

/* ─── Registry ─── */

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
  luca: {
    id: "luca",
    displayName: "Luca AI",
    description: "Director strategico, segretario operativo dell'Operations Center. Coordina tutti gli agenti e gestisce le richieste dell'utente.",
    coreFile: "core/luca",
    avatarIcon: "Brain",
    avatarColor: "primary",
    category: "core",
    roleInModel: "oracolo",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "doctrine/safety-guardrails",
      "doctrine/anti-hallucination",
      "doctrine/data-availability",
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Uscite",
    ],
    requiredVars: ["user_alias", "user_company", "user_sector"],
    promptSources: [
      { label: "System prompt principale", source: "core/luca", promptLabTab: "system", hint: "Prompt base con ruolo e personalità" },
      { label: "Dottrina sicurezza", source: "doctrine/safety-guardrails", promptLabTab: "doctrine" },
      { label: "Anti-allucinazione", source: "doctrine/anti-hallucination", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "ai-assistant",
      modelDefault: "gpt-4o",
      triggers: ["Chat diretta utente", "Richieste da Operations Center", "Fallback da altri agenti"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ message: string, context?: ConversationContext, user: UserProfile }",
      output: "{ reply: string, actions?: PendingAction[], suggestions?: string[] }",
    },
  },

  "super-assistant": {
    id: "super-assistant",
    displayName: "Super Consulente",
    description: "Super Consulente Strategico per pianificazione e Daily Plan. Gestisce strategie commerciali e roadmap operativa.",
    coreFile: "core/super-assistant",
    avatarIcon: "Lightbulb",
    avatarColor: "accent",
    category: "core",
    roleInModel: "oracolo",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "doctrine/anti-hallucination",
      "doctrine/data-availability",
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Multi-Canale",
      "Progressione Relazionale",
    ],
    requiredVars: ["user_alias"],
    promptSources: [
      { label: "System prompt consulente", source: "core/super-assistant", promptLabTab: "system" },
      { label: "Dottrina multi-canale", source: "Dottrina Multi-Canale", promptLabTab: "doctrine" },
      { label: "Progressione relazionale", source: "Progressione Relazionale", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "unified-assistant",
      modelDefault: "gpt-4o",
      triggers: ["Chat sidebar consulente", "Richiesta strategica", "Daily plan generation"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ message: string, context?: ConversationContext }",
      output: "{ reply: string, dailyPlan?: DailyPlanItem[] }",
    },
  },

  "contacts-assistant": {
    id: "contacts-assistant",
    displayName: "Assistente Contatti",
    description: "Assistente maschera contatti, opera su imported_contacts. Risponde a domande sui dati CRM con query sicure.",
    coreFile: "core/contacts-assistant",
    avatarIcon: "Users",
    avatarColor: "secondary",
    category: "core",
    roleInModel: "worker",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "procedures/ai-query-engine",
      "doctrine/data-availability",
      "procedures/lead-qualification-v2",
    ],
    requiredVars: [],
    promptSources: [
      { label: "System prompt contatti", source: "core/contacts-assistant", promptLabTab: "system" },
      { label: "Query engine", source: "procedures/ai-query-engine", promptLabTab: "procedures" },
      { label: "Lead qualification v2", source: "procedures/lead-qualification-v2", promptLabTab: "procedures" },
    ],
    runtime: {
      edgeFunction: "ai-assistant",
      modelDefault: "gpt-4o-mini",
      triggers: ["Chat nella maschera contatti", "Domande sul CRM"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: ["query-planner"],
    contract: {
      input: "{ message: string, contactContext?: ContactRow }",
      output: "{ reply: string, queryResult?: Record<string, unknown>[] }",
    },
  },

  "cockpit-assistant": {
    id: "cockpit-assistant",
    displayName: "Cockpit Command",
    description: "Command Bar del Cockpit outreach, output JSON strutturato. Gestisce invio email, WhatsApp e sequenze multicanale.",
    coreFile: "core/cockpit-assistant",
    avatarIcon: "Terminal",
    avatarColor: "primary",
    category: "core",
    roleInModel: "worker",
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
    promptSources: [
      { label: "System prompt cockpit", source: "core/cockpit-assistant", promptLabTab: "system" },
      { label: "Procedura email singola", source: "procedures/email-single", promptLabTab: "procedures" },
      { label: "Procedura WhatsApp", source: "procedures/whatsapp-message", promptLabTab: "procedures" },
      { label: "Sequenza multicanale", source: "procedures/multi-channel-sequence", promptLabTab: "procedures" },
    ],
    runtime: {
      edgeFunction: "ai-assistant",
      modelDefault: "gpt-4o",
      triggers: ["Command bar cockpit", "Azione outreach rapida", "Sequenza automatica"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ command: string, partnerContext?: PartnerRow }",
      output: "{ actions: CockpitAction[], preview?: string }",
    },
  },

  "email-improver": {
    id: "email-improver",
    displayName: "Email Improver",
    description: "Copywriter B2B che migliora email mantenendo voce dell'autore. Applica tecniche di persuasione e ottimizza il tono.",
    coreFile: "core/email-improver",
    avatarIcon: "Sparkles",
    avatarColor: "accent",
    category: "email",
    roleInModel: "migliora",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "procedures/email-improvement-techniques",
      "§1 Filosofia di vendita",
      "§4 Cold Outreach",
      "§10 Tono e registro",
    ],
    requiredVars: ["user_alias", "user_company", "user_tone"],
    promptSources: [
      { label: "System prompt improver", source: "core/email-improver", promptLabTab: "system" },
      { label: "Tecniche miglioramento", source: "procedures/email-improvement-techniques", promptLabTab: "procedures" },
      { label: "Filosofia vendita", source: "§1 Filosofia di vendita", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "improve-email",
      modelDefault: "gpt-4o",
      triggers: ["Pulsante 'Migliora' su bozza email", "Auto-improve pipeline"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ draft: string, tone?: string, context?: PartnerContext }",
      output: "{ improved: string, changes: string[], score: number }",
    },
  },

  "daily-briefing": {
    id: "daily-briefing",
    displayName: "Daily Briefing",
    description: "Direttore operativo che genera briefing mattutino JSON. Riassume attività, priorità e azioni del giorno.",
    coreFile: "core/daily-briefing",
    avatarIcon: "Newspaper",
    avatarColor: "secondary",
    category: "analysis",
    roleInModel: "worker",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Workflow Gate",
    ],
    requiredVars: [],
    promptSources: [
      { label: "System prompt briefing", source: "core/daily-briefing", promptLabTab: "system" },
      { label: "Holding Pattern", source: "LEGGE FONDAMENTALE — Holding Pattern", promptLabTab: "doctrine" },
      { label: "Workflow Gate", source: "Dottrina Workflow Gate", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "daily-briefing",
      modelDefault: "gpt-4o",
      triggers: ["Cron mattutino automatico", "Richiesta manuale briefing"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ userId: string, date: string }",
      output: "{ briefing: BriefingSection[], priorities: Priority[], actions: Action[] }",
    },
  },

  "email-classifier": {
    id: "email-classifier",
    displayName: "Email Classifier",
    description: "Classificatore risposte inbound multicanale con domain routing. Analizza email in arrivo e le assegna al flusso corretto.",
    coreFile: "core/email-classifier",
    avatarIcon: "Filter",
    avatarColor: "muted",
    category: "classifier",
    roleInModel: "classifier",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures", "domain_routing"],
    criticalProcedures: [
      "procedures/lead-qualification-v2",
      "Dottrina Uscite",
      "Regole smistamento per dominio",
    ],
    requiredVars: [],
    promptSources: [
      { label: "System prompt classifier", source: "core/email-classifier", promptLabTab: "system" },
      { label: "Lead qualification", source: "procedures/lead-qualification-v2", promptLabTab: "procedures" },
      { label: "Smistamento dominio", source: "Regole smistamento per dominio", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "classify-email-response",
      modelDefault: "gpt-4o-mini",
      triggers: ["Email inbound ricevuta", "Webhook inbox", "Check-inbox manuale"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ email: InboundEmail, senderHistory?: EmailThread[] }",
      output: "{ classification: EmailClass, sentiment: string, suggestedAction: string, domain: string }",
    },
  },

  "query-planner": {
    id: "query-planner",
    displayName: "Query Planner",
    description: "Pianificatore query SELECT sicure, mai esegue. Traduce domande in linguaggio naturale in query SQL sicure.",
    coreFile: "core/query-planner",
    avatarIcon: "Database",
    avatarColor: "muted",
    category: "core",
    roleInModel: "worker",
    kbCategories: ["doctrine", "procedures"],
    criticalProcedures: ["procedures/ai-query-engine"],
    requiredVars: [],
    promptSources: [
      { label: "System prompt query", source: "core/query-planner", promptLabTab: "system" },
      { label: "AI Query Engine", source: "procedures/ai-query-engine", promptLabTab: "procedures" },
    ],
    runtime: {
      edgeFunction: "ai-assistant",
      modelDefault: "gpt-4o-mini",
      triggers: ["Domanda CRM da contacts-assistant", "Richiesta dati da cockpit"],
    },
    tools: [],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ question: string, schema: TableSchema[] }",
      output: "{ sql: string, explanation: string, safe: boolean }",
    },
  },

  "generate-email": {
    id: "generate-email",
    displayName: "Email Generator",
    description: "Generatore email B2B con ricerca partner e knowledge base. Crea email personalizzate basate sul profilo del destinatario.",
    coreFile: "",
    avatarIcon: "Mail",
    avatarColor: "primary",
    category: "email",
    roleInModel: "genera",
    kbCategories: ["email_forge", "sales_doctrine", "email_templates"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Template email forge", source: "email_forge", promptLabTab: "templates" },
      { label: "Dottrina vendita", source: "sales_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "generate-email",
      modelDefault: "gpt-4o",
      triggers: ["Pulsante 'Genera email'", "Sequenza outreach automatica"],
    },
    tools: ["search_partners", "get_partner_detail", "read_kb"],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ partnerId: string, template?: string, context?: OutreachContext }",
      output: "{ subject: string, body: string, tone: string, personalization: string[] }",
    },
  },

  "generate-outreach": {
    id: "generate-outreach",
    displayName: "Outreach Generator",
    description: "Generatore strategie outreach multicanale con code queueing. Pianifica sequenze email/WA/LinkedIn.",
    coreFile: "",
    avatarIcon: "Send",
    avatarColor: "accent",
    category: "outreach",
    roleInModel: "genera",
    kbCategories: ["outreach_doctrine", "sales_doctrine", "channel_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Dottrina outreach", source: "outreach_doctrine", promptLabTab: "doctrine" },
      { label: "Regole canale", source: "channel_rules", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "generate-outreach",
      modelDefault: "gpt-4o",
      triggers: ["Pianificazione outreach manuale", "Batch outreach da pipeline"],
    },
    tools: ["search_partners", "queue_outreach", "get_outreach_stats"],
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ partnerIds: string[], strategy?: string }",
      output: "{ sequences: OutreachSequence[], schedule: ScheduleItem[] }",
    },
  },

  "optimus-analyze": {
    id: "optimus-analyze",
    displayName: "Optimus Analyzer",
    description: "Analizzatore partner con valutazione e metriche globali. Esegue deep analysis su potenziali partner.",
    coreFile: "",
    avatarIcon: "BarChart3",
    avatarColor: "secondary",
    category: "analysis",
    roleInModel: "migliora",
    kbCategories: ["system_doctrine", "enrichment_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Regole enrichment", source: "enrichment_rules", promptLabTab: "doctrine" },
      { label: "Dottrina di sistema", source: "system_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "gpt-4o",
      triggers: ["Analisi partner manuale", "Deep search automatica"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ partnerId: string, depth?: 'quick' | 'deep' }",
      output: "{ score: number, analysis: AnalysisSection[], recommendations: string[] }",
    },
  },

  "journalists-ai": {
    id: "journalists-ai",
    displayName: "Giornalista AI",
    description: "Giornalista AI per contenuti di marca e articoli editoriali. Genera contenuti professionali con brand voice.",
    coreFile: "",
    avatarIcon: "PenTool",
    avatarColor: "accent",
    category: "email",
    roleInModel: "giornalista",
    kbCategories: ["journalism_doctrine", "brand_voice", "editorial_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Dottrina giornalistica", source: "journalism_doctrine", promptLabTab: "doctrine" },
      { label: "Brand voice", source: "brand_voice", promptLabTab: "doctrine" },
      { label: "Regole editoriali", source: "editorial_rules", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "gpt-4o",
      triggers: ["Richiesta contenuto editoriale", "Generazione articolo"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ topic: string, format: 'article' | 'post' | 'newsletter', tone?: string }",
      output: "{ content: string, title: string, summary: string }",
    },
  },

  "voice-elevenlabs": {
    id: "voice-elevenlabs",
    displayName: "Voice Agent",
    description: "Specialista voce ElevenLabs per sintesi e design vocale. Gestisce TTS e scenari di interazione vocale.",
    coreFile: "",
    avatarIcon: "Mic",
    avatarColor: "destructive",
    category: "voice",
    roleInModel: "voce",
    kbCategories: ["voice_templates", "pronunciation_rules", "voice_scenarios"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Template vocali", source: "voice_templates", promptLabTab: "templates" },
      { label: "Regole pronuncia", source: "pronunciation_rules", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "elevenlabs-v2",
      triggers: ["Richiesta sintesi vocale", "Scenario voice agent"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ text: string, voiceId?: string, scenario?: string }",
      output: "{ audioUrl: string, duration: number }",
    },
  },

  "agent-execute": {
    id: "agent-execute",
    displayName: "Agent Executor",
    description: "Executor autonomo con approvazione workflow e gate controllo. Esegue decisioni approvate e azioni di sistema.",
    coreFile: "",
    avatarIcon: "Zap",
    avatarColor: "destructive",
    category: "autonomous",
    roleInModel: "codice",
    kbCategories: ["system_doctrine", "workflow_gate"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Dottrina workflow gate", source: "workflow_gate", promptLabTab: "doctrine" },
      { label: "Dottrina di sistema", source: "system_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "agent-execute",
      modelDefault: "gpt-4o",
      triggers: ["Approvazione pending action", "Workflow automatico", "Decision engine"],
    },
    tools: ["execute_decision", "search_partners", "send_email", "create_reminder"],
    approvalRequiredTools: ["send_email", "update_lead_status", "execute_decision"],
    dependsOn: [],
    contract: {
      input: "{ decision: Decision, approved: boolean }",
      output: "{ executed: boolean, result: ActionResult, auditLog: AuditEntry }",
    },
  },

  "mission-executor": {
    id: "mission-executor",
    displayName: "Mission Executor",
    description: "Executor missioni con bulk update e autonomia controllata. Gestisce operazioni batch su grandi set di partner.",
    coreFile: "",
    avatarIcon: "Rocket",
    avatarColor: "destructive",
    category: "autonomous",
    roleInModel: "codice",
    kbCategories: ["system_doctrine", "mission_rules"],
    criticalProcedures: [],
    requiredVars: [],
    promptSources: [
      { label: "Regole missioni", source: "mission_rules", promptLabTab: "doctrine" },
      { label: "Dottrina di sistema", source: "system_doctrine", promptLabTab: "doctrine" },
    ],
    runtime: {
      edgeFunction: "",
      modelDefault: "gpt-4o",
      triggers: ["Lancio missione batch", "Coda missioni autonome"],
    },
    tools: [], // TODO: implement edge function
    approvalRequiredTools: [],
    dependsOn: [],
    contract: {
      input: "{ mission: MissionDefinition, scope: PartnerFilter }",
      output: "{ processed: number, results: MissionResult[], errors: string[] }",
    },
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
        `Core prompt: src/v2/agent/prompts/${meta.coreFile}.ts`,
        `KB categories: ${meta.kbCategories.join(", ")}`,
        meta.criticalProcedures.length > 0
          ? `Procedure critiche iniettate: ${meta.criticalProcedures.join(", ")}`
          : "Nessuna procedura critica iniettata (solo indice KB)",
        meta.requiredVars.length > 0
          ? `Variabili richieste: ${meta.requiredVars.join(", ")}`
          : "Nessuna variabile obbligatoria",
      ],
      outputFormat: "Definito nel prompt core e nella doctrine/tone-and-format della KB",
      contextInjection: [...meta.kbCategories, ...meta.criticalProcedures],
    },
  ]),
);
