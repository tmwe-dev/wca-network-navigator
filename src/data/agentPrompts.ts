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
  /** Tab del Prompt Lab che ospita l'editor di questo blocco. */
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
  /** Etichetta umana del blocco (mostrata nella colonna Prompt). */
  label: string;
  /** Descrizione tecnica della sorgente DB/file (per tooltip). */
  source: string;
  /** Riferimento per "Apri nell'editor" (chiave/categoria/id da risolvere a runtime). */
  hint?: string;
}

/** Metadata runtime: dove gira, con quale modello, chi lo invoca. */
export interface AgentRuntime {
  /** Edge function principale che esegue questo agente (o "client" se vive solo lato browser). */
  edgeFunction: string;
  /** Modello AI di default (override possibile via app_settings). */
  modelDefault: string;
  /** Trigger: chi invoca questo agente (UI/cron/webhook/altro agente). */
  triggers: string[];
}

/** Contratto I/O semplificato per modalità Architect del Lab Agent. */
export interface AgentContract {
  /** Schema sintetico dell'input atteso (firma testuale, non Zod). */
  input: string;
  /** Schema sintetico dell'output prodotto. */
  output: string;
}

export interface AgentRegistryEntry {
  id: string;
  /** Nome leggibile mostrato in Atlas. */
  displayName: string;
  /** Categoria funzionale. */
  category: AgentCategory;
  /** File del prompt core (vuoto per agenti che vivono solo in edge function). */
  coreFile: string;
  /** KB categories caricate dall'assembler a runtime. */
  kbCategories: string[];
  /** Procedure critiche iniettate esplicitamente nel system prompt. */
  criticalProcedures: string[];
  /** Variabili obbligatorie nel contesto runtime. */
  requiredVars: string[];
  /** Descrizione operativa breve. */
  description: string;
  /** Metadata runtime (dove gira, modello, trigger). */
  runtime: AgentRuntime;
  /** Contratto I/O (per Lab Agent Architect). */
  contract: AgentContract;
  /** Tool platform a cui ha accesso (id da supabase/functions/_shared/platformToolDefs/). */
  tools: string[];
  /** Sorgenti prompt visualizzate nella colonna destra di Atlas. */
  promptSources: AgentPromptSourceRef[];
  /** Avatar: icona lucide-react + colore semantico. */
  avatarIcon: string;
  avatarColor: "primary" | "secondary" | "accent" | "muted" | "destructive";
}

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
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
