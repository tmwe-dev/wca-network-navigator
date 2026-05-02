/**
 * toolCatalog.ts — Descrive i tool disponibili per uno scope.
 *
 * Il client (frontend Command) esegue gli executor dei tool. Super Mario
 * descrive solo nome / when_to_use / json_schema / risk_level così il modello
 * sa cosa può chiamare. Il postflight valida che ogni tool_call referenzia
 * un tool reale e che il risk_level sia rispettato.
 *
 * Il tool catalog è SSOT: cambia qui se aggiungi/rimuovi un tool dal Command.
 */

export type RiskLevel = "read" | "write" | "send" | "destructive";

export interface ToolDescriptor {
  name: string;
  description: string;
  when_to_use: string;
  arguments_schema: string; // descrizione testuale (gli executor sono client-side)
  risk_level: RiskLevel;
  requires_confirmation: boolean;
}

/** Catalog per scope command. Ogni voce mappa 1:1 un tool del registry frontend. */
const COMMAND_TOOLS: ToolDescriptor[] = [
  {
    name: "ai-query",
    description: "Interroga il database (partner, contatti, lead) con linguaggio naturale.",
    when_to_use: "Quando l'utente chiede di trovare/contare/filtrare/elencare entità del CRM.",
    arguments_schema: "{ prompt: string }",
    risk_level: "read",
    requires_confirmation: false,
  },
  {
    name: "search-kb",
    description: "Cerca nella knowledge base interna (procedure, dottrina, playbook).",
    when_to_use: "Quando serve contesto procedurale o documentale interno.",
    arguments_schema: "{ query: string }",
    risk_level: "read",
    requires_confirmation: false,
  },
  {
    name: "dashboard-snapshot",
    description: "Mostra metriche aggregate del giorno (KPI, pipeline, attività).",
    when_to_use: "Quando l'utente chiede 'come va', 'situazione', 'briefing'.",
    arguments_schema: "{}",
    risk_level: "read",
    requires_confirmation: false,
  },
  {
    name: "compose-email",
    description: "Prepara una bozza email (singola o batch) per uno o più partner.",
    when_to_use: "Quando l'utente chiede di preparare/scrivere email. NON invia.",
    arguments_schema: "{ partnerIds?: string[], partnerName?: string, intent?: string, tone?: string }",
    risk_level: "write",
    requires_confirmation: true,
  },
  {
    name: "send-email-direct",
    description: "Invia una email già pronta a uno o più destinatari.",
    when_to_use: "Solo dopo che la bozza è stata revisionata. Sempre con conferma utente.",
    arguments_schema: "{ draftId: string }",
    risk_level: "send",
    requires_confirmation: true,
  },
  {
    name: "send-whatsapp",
    description: "Invia un messaggio WhatsApp a un partner.",
    when_to_use: "Solo dopo conferma utente. Stealth-sync via extension.",
    arguments_schema: "{ partnerId: string, message: string }",
    risk_level: "send",
    requires_confirmation: true,
  },
  {
    name: "send-linkedin",
    description: "Invia un messaggio LinkedIn a un contatto.",
    when_to_use: "Solo dopo conferma utente. Max 300 char, no subject.",
    arguments_schema: "{ contactId: string, message: string }",
    risk_level: "send",
    requires_confirmation: true,
  },
  {
    name: "deep-search-partner",
    description: "Investigazione approfondita su un partner (web + KB + storico).",
    when_to_use: "Quando servono dettagli che non sono nel CRM.",
    arguments_schema: "{ partnerId?: string, query: string }",
    risk_level: "read",
    requires_confirmation: false,
  },
  {
    name: "schedule-activity",
    description: "Programma un'attività futura (followup, call, reminder).",
    when_to_use: "Quando l'utente chiede di pianificare/ricordare/scadenzare.",
    arguments_schema: "{ partnerId?: string, kind: string, due_at: string, note?: string }",
    risk_level: "write",
    requires_confirmation: true,
  },
  {
    name: "update-partner-status",
    description: "Aggiorna lead_status di un partner (qualified, holding, archived…).",
    when_to_use: "Quando l'utente chiede di cambiare lo stato commerciale di un partner.",
    arguments_schema: "{ partnerId: string, lead_status: string, reason?: string }",
    risk_level: "write",
    requires_confirmation: true,
  },
  {
    name: "daily-briefing",
    description: "Riassunto strategico del giorno (priorità, urgenze, holding).",
    when_to_use: "Quando l'utente chiede 'briefing', 'cosa devo fare oggi'.",
    arguments_schema: "{}",
    risk_level: "read",
    requires_confirmation: false,
  },
];

const SCOPE_CATALOGS: Record<string, ToolDescriptor[]> = {
  command: COMMAND_TOOLS,
};

export function loadToolCatalog(scope: string): ToolDescriptor[] {
  return SCOPE_CATALOGS[scope] ?? [];
}

/** Renderizza il catalog come blocco testuale per il system prompt. */
export function renderToolCatalog(catalog: ToolDescriptor[]): string {
  if (catalog.length === 0) return "TOOL CATALOG: (vuoto, nessun tool disponibile)";
  const lines = catalog.map((t) =>
    `- ${t.name} [risk=${t.risk_level}${t.requires_confirmation ? ", needs_confirm" : ""}]\n  ${t.description}\n  Quando: ${t.when_to_use}\n  Args: ${t.arguments_schema}`,
  );
  return `TOOL CATALOG (puoi chiamare solo questi):\n\n${lines.join("\n\n")}`;
}

/** Lookup veloce per postflight. */
export function findTool(catalog: ToolDescriptor[], name: string): ToolDescriptor | undefined {
  return catalog.find((t) => t.name === name);
}