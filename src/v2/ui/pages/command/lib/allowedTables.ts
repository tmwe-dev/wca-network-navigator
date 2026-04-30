/**
 * Whitelist tabelle business interrogabili dall'AI Query Planner client-side.
 *
 * Sostituisce il vecchio `src/v2/agent/kb/dbSchema.ts` (eliminato): lo schema
 * (colonne, tipi, enum) viene caricato live dal DB via `liveSchemaClient`.
 * Qui rimane SOLO la lista delle tabelle consentite + un default sort opzionale,
 * perché:
 *   - la whitelist è una decisione di sicurezza, non descrittiva (non può
 *     vivere nel DB altrimenti l'AI potrebbe auto-autorizzarsi).
 *   - il default sort migliora la UX quando l'AI non specifica un order.
 */

export interface AllowedTable {
  readonly name: string;
  readonly defaultSort?: { column: string; ascending: boolean };
}

export const ALLOWED_TABLES_LIST: readonly AllowedTable[] = [
  { name: "partners", defaultSort: { column: "rating", ascending: false } },
  { name: "partner_networks", defaultSort: { column: "network_name", ascending: true } },
  { name: "network_configs", defaultSort: { column: "network_name", ascending: true } },
  { name: "partner_services", defaultSort: { column: "created_at", ascending: false } },
  { name: "imported_contacts", defaultSort: { column: "created_at", ascending: false } },
  { name: "outreach_queue", defaultSort: { column: "created_at", ascending: false } },
  { name: "activities", defaultSort: { column: "due_date", ascending: true } },
  { name: "channel_messages", defaultSort: { column: "email_date", ascending: false } },
  { name: "agents" },
  { name: "agent_tasks", defaultSort: { column: "created_at", ascending: false } },
  { name: "kb_entries" },
  { name: "business_cards", defaultSort: { column: "created_at", ascending: false } },
  { name: "download_jobs", defaultSort: { column: "created_at", ascending: false } },
  { name: "campaign_jobs", defaultSort: { column: "created_at", ascending: false } },
] as const;

export const ALLOWED_TABLES = new Set(ALLOWED_TABLES_LIST.map((t) => t.name));

export function findAllowedTable(name: string): AllowedTable | undefined {
  return ALLOWED_TABLES_LIST.find((t) => t.name === name);
}