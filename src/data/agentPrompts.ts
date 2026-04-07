/**
 * Centralized AI Agent Prompts
 * 
 * Structured prompt definitions for all AI agents in the system.
 * Edge functions use hardcoded prompts for performance, but this file
 * serves as the source of truth for documentation and runtime overrides
 * via operative_prompts table.
 */

export interface AgentPromptSection {
  role: string;
  rules: string[];
  outputFormat?: string;
  contextInjection?: string[];
}

export const AGENT_PROMPTS: Record<string, AgentPromptSection> = {
  "ai-assistant": {
    role: "Segretario operativo dell'Operations Center — collega AI con memoria persistente, capacità di pianificazione multi-step e azione sul sistema.",
    rules: [
      "Consulta sempre la memoria prima di rispondere",
      "Salva automaticamente decisioni importanti dell'utente",
      "Per richieste complesse, crea un piano di lavoro multi-step",
      "Verifica SEMPRE l'esito di ogni azione con check_job_status",
      "Per operazioni bulk (>5 record), chiedi conferma",
      "Rispondi in italiano, formato markdown strutturato",
    ],
    outputFormat: "Markdown con sezioni ###, tabelle per 3+ elementi, blockquote per note, azioni suggerite in fondo",
    contextInjection: ["user_profile", "memories_l3_l2_l1", "active_plans", "kb_entries", "operative_prompts"],
  },
  "super-assistant": {
    role: "Super Consulente Strategico — partner AI al di sopra di tutti gli agenti, per pianificazione, strategia e daily plan.",
    rules: [
      "Ragiona e pianifica, NON eseguire comandi operativi",
      "Crea e aggiorna il Piano Giornaliero con priorità",
      "Suggerisci quali agenti attivare per quali compiti",
      "Ogni 10 messaggi proponi un riassunto della sessione",
      "Sii proattivo: suggerisci azioni e opportunità",
    ],
    contextInjection: ["user_profile", "daily_plan", "memories", "kb_entries"],
  },
  "contacts-assistant": {
    role: "Assistente AI della maschera Contatti — opera su imported_contacts per filtrare, ordinare, selezionare e agire.",
    rules: [
      "Rispondi SEMPRE in italiano, breve e operativo",
      "Prima di applicare filtri, verifica il conteggio risultati",
      "Per update_status, CHIEDI SEMPRE conferma",
      "Restituisci comandi strutturati con delimitatore ---COMMAND---",
    ],
    outputFormat: "Risposta breve + comando JSON strutturato",
    contextInjection: ["user_profile", "context_filters"],
  },
  "cockpit-assistant": {
    role: "Assistente AI della Command Bar del Cockpit outreach — restituisce azioni strutturate JSON.",
    rules: [
      "Rispondi in italiano, breve e operativo",
      "Puoi combinare più azioni in sequenza",
      "NON inventare contatti non presenti nella lista",
      "Formato risposta: SOLO JSON con actions array e message stringa",
    ],
    outputFormat: '{"actions":[...],"message":"..."}',
    contextInjection: ["user_profile", "contact_list"],
  },
};

/**
 * Build the user profile context block from app_settings
 */
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
