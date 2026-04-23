/**
 * Registro Metadati Agenti AI
 *
 * Espone AGENT_PROMPTS: vista compatibile per documentazione (AIExportPanel)
 */

// Internal registry used to build AGENT_PROMPTS
interface AgentRegistryEntry {
  id: string;
  coreFile: string;
  kbCategories: string[];
  criticalProcedures: string[];
  requiredVars: string[];
  description: string;
  category?: "core" | "email" | "outreach" | "analysis" | "voice" | "autonomous" | "classifier";
  icon?: string; // lucide-react icon name
  tools?: string[];
  approvalRequiredTools?: string[];
  dependsOn?: string[];
  roleInModel?: "oracolo" | "genera" | "migliora" | "giornalista" | "voce" | "codice" | "worker" | "classifier";
  inputContract?: Record<string, string>;
  outputContract?: Record<string, string>;
  edgeFunction?: string;
  modelDefault?: string;
}

const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
  "luca": {
    id: "luca",
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
    category: "core",
    roleInModel: "oracolo",
    edgeFunction: "ai-assistant",
  },
  "super-assistant": {
    id: "super-assistant",
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
    category: "core",
    roleInModel: "oracolo",
    edgeFunction: "unified-assistant",
  },
  "contacts-assistant": {
    id: "contacts-assistant",
    coreFile: "core/contacts-assistant",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "procedures/ai-query-engine",
      "doctrine/data-availability",
      "procedures/lead-qualification-v2",
    ],
    requiredVars: [],
    description: "Assistente maschera contatti, opera su imported_contacts.",
    category: "core",
    roleInModel: "worker",
  },
  "cockpit-assistant": {
    id: "cockpit-assistant",
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
    category: "core",
    roleInModel: "worker",
  },
  "email-improver": {
    id: "email-improver",
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
    category: "email",
    roleInModel: "migliora",
    edgeFunction: "improve-email",
  },
  "daily-briefing": {
    id: "daily-briefing",
    coreFile: "core/daily-briefing",
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures"],
    criticalProcedures: [
      "LEGGE FONDAMENTALE — Holding Pattern",
      "Dottrina Workflow Gate",
    ],
    requiredVars: [],
    description: "Direttore operativo che genera briefing mattutino JSON.",
    category: "analysis",
    roleInModel: "worker",
    edgeFunction: "daily-briefing",
  },
  "email-classifier": {
    id: "email-classifier",
    coreFile: "core/email-classifier",
    // LOVABLE-93: KB per domini email (operative/admin/support)
    kbCategories: ["doctrine", "system_doctrine", "sales_doctrine", "procedures", "domain_routing"],
    criticalProcedures: [
      "procedures/lead-qualification-v2",
      "Dottrina Uscite",
      "Regole smistamento per dominio",
    ],
    requiredVars: [],
    description: "Classificatore risposte inbound multicanale con domain routing.",
    category: "classifier",
    roleInModel: "classifier",
    edgeFunction: "classify-email-response",
  },
  "query-planner": {
    id: "query-planner",
    coreFile: "core/query-planner",
    kbCategories: ["doctrine", "procedures"],
    criticalProcedures: ["procedures/ai-query-engine"],
    requiredVars: [],
    description: "Pianificatore query SELECT sicure, mai esegue.",
    category: "core",
    roleInModel: "worker",
  },
  "generate-email": {
    id: "generate-email",
    coreFile: "",
    kbCategories: ["email_forge", "sales_doctrine", "email_templates"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Generatore email B2B con ricerca partner e knowledge base.",
    category: "email",
    roleInModel: "genera",
    edgeFunction: "generate-email",
    tools: ["search_partners", "get_partner_detail", "read_kb"],
  },
  "generate-outreach": {
    id: "generate-outreach",
    coreFile: "",
    kbCategories: ["outreach_doctrine", "sales_doctrine", "channel_rules"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Generatore strategie outreach multicanale con code queueing.",
    category: "outreach",
    roleInModel: "genera",
    edgeFunction: "generate-outreach",
    tools: ["search_partners", "queue_outreach", "get_outreach_stats"],
  },
  "optimus-analyze": {
    id: "optimus-analyze",
    coreFile: "",
    kbCategories: ["system_doctrine", "enrichment_rules"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Analizzatore partner con valutazione e metriche globali.",
    category: "analysis",
    roleInModel: "migliora",
    tools: ["search_partners", "evaluate_partner", "get_global_summary"],
  },
  "journalists-ai": {
    id: "journalists-ai",
    coreFile: "",
    kbCategories: ["journalism_doctrine", "brand_voice", "editorial_rules"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Giornalista AI per contenuti di marca e articoli editoriali.",
    category: "email",
    roleInModel: "giornalista",
    tools: ["read_kb", "search_memory"],
  },
  "voice-elevenlabs": {
    id: "voice-elevenlabs",
    coreFile: "",
    kbCategories: ["voice_templates", "pronunciation_rules", "voice_scenarios"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Specialista voce ElevenLabs per sintesi e design vocale.",
    category: "voice",
    roleInModel: "voce",
    tools: ["read_kb"],
  },
  "agent-execute": {
    id: "agent-execute",
    coreFile: "",
    kbCategories: ["system_doctrine", "workflow_gate"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Executor autonomo con approvazione workflow e gate controllo.",
    category: "autonomous",
    roleInModel: "codice",
    edgeFunction: "agent-execute",
    tools: ["execute_decision", "search_partners", "send_email", "create_reminder"],
    approvalRequiredTools: ["send_email", "update_lead_status", "execute_decision"],
  },
  "mission-executor": {
    id: "mission-executor",
    coreFile: "",
    kbCategories: ["system_doctrine", "mission_rules"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Executor missioni con bulk update e autonomia controllata.",
    category: "autonomous",
    roleInModel: "codice",
    tools: ["execute_decision", "search_partners", "bulk_update_partners"],
    approvalRequiredTools: ["bulk_update_partners", "execute_decision"],
  },
};

/* ─── Vista compatibile per documentazione ─── */

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
