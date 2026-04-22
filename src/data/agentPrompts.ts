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
  },
  "query-planner": {
    id: "query-planner",
    coreFile: "core/query-planner",
    kbCategories: ["doctrine", "procedures"],
    criticalProcedures: ["procedures/ai-query-engine"],
    requiredVars: [],
    description: "Pianificatore query SELECT sicure, mai esegue.",
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
