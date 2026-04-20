/**
 * Database Schema Knowledge Base
 *
 * Descrizione machine-readable delle tabelle business core del sistema.
 * Iniettata nel system prompt dell'AI Query Planner per consentire all'AI
 * di generare query autonomamente, senza tool hardcoded.
 *
 * Solo tabelle WHITELISTED qui sono interrogabili. Vedi `safeQueryExecutor.ts`.
 */

export interface ColumnDescriptor {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "date" | "uuid" | "json" | "enum";
  readonly description: string;
  readonly enumValues?: readonly string[];
  readonly searchable?: boolean;
}

export interface TableDescriptor {
  readonly name: string;
  readonly purpose: string;
  readonly primaryKey: string;
  readonly columns: readonly ColumnDescriptor[];
  readonly defaultSort?: { column: string; ascending: boolean };
  readonly examples?: readonly string[];
}

export const DB_SCHEMA: readonly TableDescriptor[] = [
  {
    name: "partners",
    purpose: "Partner della rete WCA (logistica/spedizionieri internazionali). ~25.000 record sincronizzati dalla directory esterna.",
    primaryKey: "id",
    defaultSort: { column: "rating", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID univoco" },
      { name: "company_name", type: "string", description: "Ragione sociale", searchable: true },
      { name: "country_code", type: "string", description: "Codice ISO-2 paese (es. US, IT, CN, DE)" },
      { name: "country_name", type: "string", description: "Nome paese in inglese" },
      { name: "city", type: "string", description: "Città", searchable: true },
      { name: "email", type: "string", description: "Email principale" },
      { name: "phone", type: "string", description: "Telefono fisso" },
      { name: "mobile", type: "string", description: "Cellulare" },
      { name: "website", type: "string", description: "Sito web" },
      { name: "rating", type: "number", description: "Rating 0-5" },
      { name: "is_active", type: "boolean", description: "Membership attiva" },
      { name: "is_favorite", type: "boolean", description: "Marcato come preferito dall'utente" },
      {
        name: "lead_status",
        type: "enum",
        description: "Stato commerciale del lead",
        enumValues: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"],
      },
      { name: "office_type", type: "string", description: "Tipo ufficio: HQ o branch" },
      { name: "interaction_count", type: "number", description: "Numero interazioni registrate" },
      { name: "last_interaction_at", type: "date", description: "Ultima interazione" },
      { name: "member_since", type: "date", description: "Data ingresso nella rete" },
      { name: "created_at", type: "date", description: "Data creazione record" },
    ],
    examples: [
      "partner US attivi con rating > 4 → table=partners, filters=[country_code eq US, is_active eq true, rating gt 4]",
      "partner italiani contattati di recente → table=partners, filters=[country_code eq IT, lead_status eq contacted], sort last_interaction_at desc",
    ],
  },
  {
    name: "imported_contacts",
    purpose: "Contatti CRM importati (clienti, lead, prospect). Diversi da partner (rete WCA).",
    primaryKey: "id",
    defaultSort: { column: "created_at", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID univoco" },
      { name: "name", type: "string", description: "Nome completo persona", searchable: true },
      { name: "company_name", type: "string", description: "Azienda", searchable: true },
      { name: "email", type: "string", description: "Email" },
      { name: "phone", type: "string", description: "Telefono" },
      { name: "mobile", type: "string", description: "Cellulare" },
      { name: "country", type: "string", description: "Paese (formato libero o ISO)" },
      { name: "origin", type: "string", description: "Origine del contatto (es. fiera, import, web)" },
      {
        name: "lead_status",
        type: "enum",
        description: "Stato lead",
        enumValues: ["new", "first_touch_sent", "holding", "engaged", "qualified", "negotiation", "converted", "archived", "blacklisted"],
      },
      { name: "interaction_count", type: "number", description: "Interazioni registrate" },
      { name: "last_interaction_at", type: "date", description: "Ultima interazione" },
      { name: "wca_partner_id", type: "uuid", description: "ID partner WCA collegato (se matchato)" },
      { name: "created_at", type: "date", description: "Data import" },
    ],
  },
  {
    name: "outreach_queue",
    purpose: "Coda messaggi outbound (email/whatsapp/linkedin) verso partner/contatti.",
    primaryKey: "id",
    defaultSort: { column: "created_at", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "partner_id", type: "uuid", description: "Partner destinatario" },
      { name: "channel", type: "enum", description: "Canale invio", enumValues: ["email", "whatsapp", "linkedin"] },
      { name: "recipient_email", type: "string", description: "Email destinatario" },
      { name: "subject", type: "string", description: "Oggetto" },
      {
        name: "status",
        type: "enum",
        description: "Stato invio",
        enumValues: ["pending", "approved", "sent", "delivered", "replied", "bounced", "failed", "running"],
      },
      { name: "scheduled_at", type: "date", description: "Programmato per" },
      { name: "processed_at", type: "date", description: "Inviato il" },
      { name: "replied_at", type: "date", description: "Risposta ricevuta il" },
      { name: "created_at", type: "date", description: "Creato il" },
    ],
  },
  {
    name: "activities",
    purpose: "Attività CRM (chiamate, follow-up, reminder, meeting).",
    primaryKey: "id",
    defaultSort: { column: "due_date", ascending: true },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "title", type: "string", description: "Titolo attività", searchable: true },
      { name: "description", type: "string", description: "Descrizione" },
      { name: "activity_type", type: "string", description: "Tipo (call, email, meeting, follow_up, ecc.)" },
      { name: "status", type: "enum", description: "Stato", enumValues: ["pending", "in_progress", "completed", "cancelled"] },
      { name: "priority", type: "enum", description: "Priorità", enumValues: ["low", "medium", "high", "urgent"] },
      { name: "partner_id", type: "uuid", description: "Partner collegato" },
      { name: "due_date", type: "date", description: "Scadenza" },
      { name: "scheduled_at", type: "date", description: "Programmata per" },
      { name: "completed_at", type: "date", description: "Completata il" },
      { name: "response_received", type: "boolean", description: "Risposta ricevuta" },
      { name: "created_at", type: "date", description: "Creata il" },
    ],
  },
  {
    name: "channel_messages",
    purpose: "Messaggi email/whatsapp/linkedin sincronizzati (inbound + outbound).",
    primaryKey: "id",
    defaultSort: { column: "email_date", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "channel", type: "enum", description: "Canale", enumValues: ["email", "whatsapp", "linkedin"] },
      { name: "direction", type: "enum", description: "Verso", enumValues: ["inbound", "outbound"] },
      { name: "from_address", type: "string", description: "Mittente" },
      { name: "to_address", type: "string", description: "Destinatario" },
      { name: "subject", type: "string", description: "Oggetto", searchable: true },
      { name: "body_text", type: "string", description: "Corpo testo" },
      { name: "email_date", type: "date", description: "Data messaggio" },
      { name: "read_at", type: "date", description: "Letto il" },
      { name: "partner_id", type: "uuid", description: "Partner collegato" },
      { name: "category", type: "string", description: "Categoria (auto-classificata)" },
    ],
  },
  {
    name: "agents",
    purpose: "Agenti AI configurati nel sistema.",
    primaryKey: "id",
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "name", type: "string", description: "Nome agente", searchable: true },
      { name: "role", type: "string", description: "Ruolo (commerciale, supporto, director, ecc.)" },
      { name: "is_active", type: "boolean", description: "Attivo" },
      { name: "avatar_emoji", type: "string", description: "Emoji avatar" },
      { name: "created_at", type: "date", description: "Creato il" },
    ],
  },
  {
    name: "agent_tasks",
    purpose: "Task assegnati agli agenti AI.",
    primaryKey: "id",
    defaultSort: { column: "created_at", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "agent_id", type: "uuid", description: "Agente assegnato" },
      { name: "task_type", type: "string", description: "Tipo task" },
      { name: "description", type: "string", description: "Descrizione" },
      {
        name: "status",
        type: "enum",
        description: "Stato",
        enumValues: ["proposed", "pending", "running", "completed", "failed", "cancelled"],
      },
      { name: "scheduled_at", type: "date", description: "Programmato per" },
      { name: "started_at", type: "date", description: "Iniziato il" },
      { name: "completed_at", type: "date", description: "Completato il" },
      { name: "created_at", type: "date", description: "Creato il" },
    ],
  },
  {
    name: "kb_entries",
    purpose: "Knowledge Base entries (documentazione interna, doctrine commerciale).",
    primaryKey: "id",
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "title", type: "string", description: "Titolo", searchable: true },
      { name: "content", type: "string", description: "Contenuto markdown" },
      { name: "category", type: "string", description: "Categoria" },
      { name: "chapter", type: "string", description: "Capitolo" },
      { name: "priority", type: "number", description: "Priorità 0-100" },
      { name: "is_active", type: "boolean", description: "Attivo" },
      { name: "access_count", type: "number", description: "Numero accessi" },
    ],
  },
  {
    name: "business_cards",
    purpose: "Biglietti da visita digitalizzati via OCR.",
    primaryKey: "id",
    defaultSort: { column: "created_at", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "contact_name", type: "string", description: "Nome contatto", searchable: true },
      { name: "company_name", type: "string", description: "Azienda", searchable: true },
      { name: "email", type: "string", description: "Email" },
      { name: "phone", type: "string", description: "Telefono" },
      { name: "position", type: "string", description: "Ruolo" },
      { name: "location", type: "string", description: "Luogo" },
      { name: "event_name", type: "string", description: "Evento di provenienza" },
      { name: "match_status", type: "enum", description: "Match", enumValues: ["matched", "unmatched", "needs_review"] },
      { name: "match_confidence", type: "number", description: "Confidenza match 0-100" },
      { name: "matched_partner_id", type: "uuid", description: "Partner abbinato" },
      { name: "lead_status", type: "string", description: "Stato lead" },
      { name: "created_at", type: "date", description: "Acquisito il" },
    ],
  },
  {
    name: "download_jobs",
    purpose: "Job di sincronizzazione massiva (scraping/download dati esterni).",
    primaryKey: "id",
    defaultSort: { column: "created_at", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "job_type", type: "string", description: "Tipo job" },
      { name: "status", type: "enum", description: "Stato", enumValues: ["pending", "running", "completed", "failed", "cancelled"] },
      { name: "country_code", type: "string", description: "Paese target (se applicabile)" },
      { name: "progress", type: "number", description: "Avanzamento 0-100" },
      { name: "created_at", type: "date", description: "Avviato il" },
      { name: "completed_at", type: "date", description: "Completato il" },
    ],
  },
  {
    name: "campaign_jobs",
    purpose: "Job di campagne outbound (assegnazioni a operatori).",
    primaryKey: "id",
    defaultSort: { column: "created_at", ascending: false },
    columns: [
      { name: "id", type: "uuid", description: "ID" },
      { name: "batch_id", type: "uuid", description: "Batch campagna" },
      { name: "company_name", type: "string", description: "Azienda target", searchable: true },
      { name: "country_code", type: "string", description: "Paese ISO" },
      { name: "country_name", type: "string", description: "Paese" },
      { name: "city", type: "string", description: "Città" },
      { name: "email", type: "string", description: "Email contatto" },
      { name: "job_type", type: "enum", description: "Tipo", enumValues: ["call", "email", "visit", "qualify"] },
      { name: "status", type: "enum", description: "Stato", enumValues: ["pending", "in_progress", "completed", "skipped"] },
      { name: "partner_id", type: "uuid", description: "Partner collegato" },
      { name: "created_at", type: "date", description: "Creato il" },
    ],
  },
] as const;

/** Lista tabelle whitelisted per il safe executor */
export const ALLOWED_TABLES = new Set(DB_SCHEMA.map((t) => t.name));

/** Renderizza lo schema in formato testuale compatto per il system prompt LLM */
export function renderSchemaForPrompt(): string {
  return DB_SCHEMA.map((t) => {
    const cols = t.columns
      .map((c) => {
        const enumPart = c.enumValues ? ` [${c.enumValues.join("|")}]` : "";
        return `    - ${c.name} (${c.type})${enumPart}: ${c.description}`;
      })
      .join("\n");
    const examples = t.examples?.length
      ? `\n  Esempi:\n${t.examples.map((e) => `    • ${e}`).join("\n")}`
      : "";
    return `📊 ${t.name}\n  Scopo: ${t.purpose}\n  PK: ${t.primaryKey}\n  Colonne:\n${cols}${examples}`;
  }).join("\n\n");
}
