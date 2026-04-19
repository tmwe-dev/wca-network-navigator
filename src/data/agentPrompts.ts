/**
 * Registro Metadati Agenti AI
 *
 * NON contiene più prompt completi. Quelli vivono in:
 *   - src/v2/agent/prompts/core/*.ts (client)
 *   - supabase/functions/_shared/prompts/assembler.ts (edge, inline)
 *
 * Questo file espone:
 *   - AGENT_REGISTRY: metadati per l'assembler (kbCategories, criticalProcedures, requiredVars)
 *   - AGENT_PROMPTS: vista compatibile per documentazione (AIExportPanel)
 *   - buildUserProfileBlock: helper variabili profilo utente
 */

export interface AgentRegistryEntry {
  /** ID usato dall'assembler */
  id: string;
  /** Nome file core (senza estensione) */
  coreFile: string;
  /** Categorie KB da indicizzare nel prompt */
  kbCategories: string[];
  /** Titoli kb_entries da iniettare come estratto inline (workflow critici) */
  criticalProcedures: string[];
  /** Variabili obbligatorie da risolvere a runtime */
  requiredVars: string[];
  /** Descrizione human-readable */
  description: string;
}

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
  "luca": {
    id: "luca",
    coreFile: "core/luca",
    kbCategories: ["procedures", "doctrine"],
    criticalProcedures: ["doctrine/safety-guardrails", "doctrine/anti-hallucination", "doctrine/data-availability"],
    requiredVars: ["user_alias", "user_company", "user_sector"],
    description: "Director strategico, segretario operativo dell'Operations Center.",
  },
  "super-assistant": {
    id: "super-assistant",
    coreFile: "core/super-assistant",
    kbCategories: ["procedures", "doctrine"],
    criticalProcedures: ["doctrine/anti-hallucination", "doctrine/data-availability"],
    requiredVars: ["user_alias"],
    description: "Super Consulente Strategico per pianificazione e Daily Plan.",
  },
  "contacts-assistant": {
    id: "contacts-assistant",
    coreFile: "core/contacts-assistant",
    kbCategories: ["procedures", "doctrine"],
    criticalProcedures: ["procedures/ai-query-engine", "doctrine/data-availability"],
    requiredVars: [],
    description: "Assistente maschera contatti, opera su imported_contacts.",
  },
  "cockpit-assistant": {
    id: "cockpit-assistant",
    coreFile: "core/cockpit-assistant",
    kbCategories: ["procedures", "doctrine"],
    criticalProcedures: ["procedures/outreach-flow", "doctrine/data-availability"],
    requiredVars: [],
    description: "Command Bar del Cockpit outreach, output JSON strutturato.",
  },
  "email-improver": {
    id: "email-improver",
    coreFile: "core/email-improver",
    kbCategories: ["procedures", "doctrine"],
    criticalProcedures: ["procedures/email-improvement-techniques"],
    requiredVars: ["user_alias", "user_company", "user_tone"],
    description: "Copywriter B2B che migliora email mantenendo voce dell'autore.",
  },
  "daily-briefing": {
    id: "daily-briefing",
    coreFile: "core/daily-briefing",
    kbCategories: ["procedures", "doctrine"],
    criticalProcedures: [],
    requiredVars: [],
    description: "Direttore operativo che genera briefing mattutino JSON.",
  },
  "email-classifier": {
    id: "email-classifier",
    coreFile: "core/email-classifier",
    kbCategories: ["procedures"],
    criticalProcedures: ["procedures/lead-qualification"],
    requiredVars: [],
    description: "Classificatore risposte inbound multicanale.",
  },
  "query-planner": {
    id: "query-planner",
    coreFile: "core/query-planner",
    kbCategories: ["procedures"],
    criticalProcedures: ["procedures/ai-query-engine"],
    requiredVars: [],
    description: "Pianificatore query SELECT sicure, mai esegue.",
  },
};

/* ─── Vista compatibile per documentazione ─── */

export interface AgentPromptSection {
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

/* ─── Helper variabili profilo utente ─── */

export function buildUserProfileBlock(settings: Record<string, string | null>): string {
  const parts: string[] = [];
  const get = (key: string) => settings[key]?.trim() || "";

  if (get("ai_company_name") || get("ai_company_alias")) {
    parts.push(`AZIENDA: ${get("ai_company_name")} (${get("ai_company_alias")})`);
  }
  if (get("ai_contact_name") || get("ai_contact_alias")) {
    parts.push(`REFERENTE: ${get("ai_contact_name")} (${get("ai_contact_alias")}) — ${get("ai_contact_role")}`);
  }
  if (get("ai_sector")) parts.push(`SETTORE: ${get("ai_sector")}`);
  if (get("ai_networks")) parts.push(`NETWORK: ${get("ai_networks")}`);
  if (get("ai_company_activities")) parts.push(`ATTIVITÀ: ${get("ai_company_activities")}`);
  if (get("ai_business_goals")) parts.push(`OBIETTIVI ATTUALI: ${get("ai_business_goals")}`);
  if (get("ai_tone")) parts.push(`TONO: ${get("ai_tone")}`);
  if (get("ai_language")) parts.push(`LINGUA: ${get("ai_language")}`);
  if (get("ai_behavior_rules")) parts.push(`REGOLE COMPORTAMENTALI:\n${get("ai_behavior_rules")}`);
  if (get("ai_style_instructions")) parts.push(`ISTRUZIONI STILE: ${get("ai_style_instructions")}`);
  if (get("ai_sector_notes")) parts.push(`NOTE SETTORE: ${get("ai_sector_notes")}`);

  if (parts.length === 0) return "";
  return `\n\nPROFILO UTENTE E AZIENDA:\n${parts.join("\n")}`;
}

/** Estrae mappa variabili runtime da app_settings per assembler */
export function buildRuntimeVariables(settings: Record<string, string | null>): Record<string, string> {
  const get = (key: string) => settings[key]?.trim() || "";
  return {
    user_alias: get("ai_contact_alias") || get("ai_contact_name"),
    user_company: get("ai_company_name") || get("ai_company_alias"),
    user_role: get("ai_contact_role"),
    user_sector: get("ai_sector"),
    user_tone: get("ai_tone") || "professionale",
    user_language: get("ai_language") || "it",
  };
}
