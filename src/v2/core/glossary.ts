/**
 * SSOT Glossary — Vol. III §4
 *
 * Mappa termini di dominio approvati.
 * Nessun nome generico (data, temp, result, info, item, stuff).
 */

export const GLOSSARY = Object.freeze({
  partner: {
    table: "partners",
    description: "Azienda membro di un network WCA",
  },
  contact: {
    table: "imported_contacts",
    description: "Contatto importato o manuale associato a un partner",
  },
  agent: {
    table: "agents",
    description: "Agente AI con ruolo, prompt, strumenti assegnati",
  },
  activity: {
    table: "activities",
    description: "Attività CRM: call, email, meeting, note, task, follow-up",
  },
  campaign: {
    table: "campaign_jobs",
    description: "Campagna outreach con coda di job",
  },
  downloadJob: {
    table: "download_jobs",
    description: "Job di download/scraping da network WCA",
  },
  kbEntry: {
    table: "kb_entries",
    description: "Entry della knowledge base per RAG",
  },
  aiMemory: {
    table: "ai_memory",
    description: "Memoria episodica AI con decay e promozione",
  },
  emailTemplate: {
    table: "email_templates",
    description: "Template HTML per email outreach",
  },
  channelMessage: {
    table: "channel_messages",
    description: "Email inviata/ricevuta nel sistema",
  },
  importLog: {
    table: "import_logs",
    description: "Log di importazione CSV/Excel",
  },
  businessCard: {
    table: "business_cards",
    description: "Biglietto da visita scansionato/importato",
  },
} as const);

/**
 * Nomi vietati per variabili di dominio.
 * Vol. III §4: "Nessun data, temp, result, info, item, stuff."
 */
export const FORBIDDEN_NAMES = Object.freeze([
  "data",
  "temp",
  "result",
  "info",
  "item",
  "stuff",
  "obj",
  "val",
  "tmp",
  "res",
  "ret",
] as const);
