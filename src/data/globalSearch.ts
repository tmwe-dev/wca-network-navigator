/**
 * DAL — Ricerca globale di sistema.
 * Aggrega partner, contatti (rubrica unificata), email in coda e
 * introspezione schema (tabelle/campi) per la palette ⌘K.
 */
import { supabase } from "@/integrations/supabase/client";
import { rpcIntrospectSchema, type LiveIntrospectTable } from "@/data/rpc";

export interface GlobalPartnerHit {
  id: string;
  company_name: string;
  city: string | null;
  country_name: string | null;
}

export interface GlobalContactHit {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  source: "contatti" | "partner" | "biglietti";
}

export interface GlobalFieldHit {
  table: string;
  column: string;
  type: string;
}

export interface GlobalDataResults {
  partners: GlobalPartnerHit[];
  contacts: GlobalContactHit[];
  fields: GlobalFieldHit[];
}

/** Tabelle core esposte alla ricerca "campi di sistema". */
export const SEARCHABLE_TABLES = [
  "partners",
  "partner_contacts",
  "imported_contacts",
  "business_cards",
  "activities",
  "deals",
  "prospects",
  "ai_pending_actions",
  "email_campaign_queue",
  "channel_messages",
  "email_drafts",
  "kb_entries",
  "operative_prompts",
  "agents",
  "outreach_queue",
  "cockpit_queue",
  "notifications",
  "app_settings",
] as const;

function like(term: string): string {
  return `%${term.replace(/[%,]/g, "")}%`;
}

let schemaCache: LiveIntrospectTable[] | null = null;

/** Introspezione schema con cache in-memory (una sola chiamata per sessione). */
export async function loadSchemaCatalog(): Promise<LiveIntrospectTable[]> {
  if (schemaCache) return schemaCache;
  const data = await rpcIntrospectSchema(SEARCHABLE_TABLES);
  schemaCache = data ?? [];
  return schemaCache;
}

function searchFields(catalog: LiveIntrospectTable[], term: string, limit: number): GlobalFieldHit[] {
  const t = term.toLowerCase();
  const out: GlobalFieldHit[] = [];
  for (const tbl of catalog) {
    const tableMatch = tbl.table.toLowerCase().includes(t);
    for (const col of tbl.columns ?? []) {
      if (out.length >= limit) return out;
      if (tableMatch || col.name.toLowerCase().includes(t)) {
        out.push({ table: tbl.table, column: col.name, type: col.type });
      }
    }
  }
  return out;
}

/** Ricerca trasversale su dati + schema. */
export async function searchEverything(term: string, limit = 6): Promise<GlobalDataResults> {
  const t = term.trim();
  if (t.length < 2) return { partners: [], contacts: [], fields: [] };
  const pattern = like(t);

  const [partners, ic, pc, bc, catalog] = await Promise.all([
    supabase
      .from("partners")
      .select("id, company_name, city, country_name")
      .or(`company_name.ilike.${pattern},company_alias.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("imported_contacts")
      .select("id, name, company_name, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("partner_contacts")
      .select("id, name, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("business_cards")
      .select("id, contact_name, company_name, email")
      .or(`contact_name.ilike.${pattern},email.ilike.${pattern},company_name.ilike.${pattern}`)
      .limit(limit),
    loadSchemaCatalog().catch(() => [] as LiveIntrospectTable[]),
  ]);

  const contacts: GlobalContactHit[] = [];
  for (const r of ic.data ?? [])
    contacts.push({ id: `ic-${r.id}`, name: r.name, email: r.email, company: r.company_name, source: "contatti" });
  for (const r of pc.data ?? [])
    contacts.push({ id: `pc-${r.id}`, name: r.name, email: r.email, company: null, source: "partner" });
  for (const r of bc.data ?? [])
    contacts.push({
      id: `bc-${r.id}`,
      name: r.contact_name,
      email: r.email,
      company: r.company_name,
      source: "biglietti",
    });

  return {
    partners: (partners.data ?? []) as GlobalPartnerHit[],
    contacts: contacts.slice(0, limit * 2),
    fields: searchFields(catalog, t, limit),
  };
}
