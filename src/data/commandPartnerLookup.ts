/**
 * DAL — lookup partner/contact per il tool "compose email" della Command page.
 * Estratto 1:1 da `partnerQueries.ts` (stessi filtri, order, limit, select).
 */
import { supabase } from "@/integrations/supabase/client";
import { applyValidatedFilters, readValidatedRows, selectFromValidatedTable } from "@/data/validatedQuery";

export interface CommandPartnerRow {
  id: string;
  company_name: string | null;
  company_alias: string | null;
  country_code: string | null;
  city: string | null;
  email: string | null;
  website: string | null;
  lead_status: string | null;
  status_reason: string | null;
  last_interaction_at: string | null;
}

export interface CommandContactRow {
  id: string;
  partner_id: string | null;
  name: string | null;
  contact_alias: string | null;
  email: string | null;
  title: string | null;
}

/** Validatore runtime per le righe partner lette dal confine dinamico. */
function parseCommandPartnerRow(row: Record<string, unknown>): CommandPartnerRow | null {
  const id = typeof row.id === "string" ? row.id : null;
  if (!id) return null;
  const s = (v: unknown): string | null => (typeof v === "string" ? v : null);
  return {
    id,
    company_name: s(row.company_name),
    company_alias: s(row.company_alias),
    country_code: s(row.country_code),
    city: s(row.city),
    email: s(row.email),
    website: s(row.website),
    lead_status: s(row.lead_status),
    status_reason: s(row.status_reason),
    last_interaction_at: s(row.last_interaction_at),
  };
}

const PARTNER_COLS = "id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at";

/** Colonne di `partners` filtrabili da un contesto salvato dal planner. */
const PARTNER_FILTERABLE_COLUMNS: ReadonlySet<string> = new Set([
  "company_name",
  "company_alias",
  "country_code",
  "country_name",
  "city",
  "email",
  "website",
  "lead_status",
  "status_reason",
  "partner_type",
  "is_active",
]);

export async function searchPartnersByCountry(countryCode: string): Promise<CommandPartnerRow[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLS)
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .neq("lead_status", "blacklisted")
    .order("company_name")
    .limit(50);
  if (error) return [];
  return (data ?? []) as CommandPartnerRow[];
}

export async function fetchPartnersByIds(ids: ReadonlyArray<string>): Promise<CommandPartnerRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLS)
    .in("id", ids as string[])
    .eq("is_active", true)
    .neq("lead_status", "blacklisted");
  if (error) return [];
  return (data ?? []) as CommandPartnerRow[];
}

export async function searchPartner(company: string | null, email: string | null): Promise<CommandPartnerRow[]> {
  let q = supabase
    .from("partners")
    .select(PARTNER_COLS)
    .limit(5);
  if (email) {
    q = q.eq("email", email);
  } else if (company) {
    q = q.or(`company_name.ilike.%${company}%,company_alias.ilike.%${company}%`);
  } else {
    return [];
  }
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as CommandPartnerRow[];
}

export async function findPartnerContact(partnerId: string, person: string | null, email: string | null): Promise<CommandContactRow | null> {
  let q = supabase
    .from("partner_contacts")
    .select("id, partner_id, name, contact_alias, email, title")
    .eq("partner_id", partnerId)
    .limit(5);
  if (email) q = q.eq("email", email);
  const { data } = await q;
  const rows = (data ?? []) as CommandContactRow[];
  if (rows.length === 0) return null;
  if (!person) return rows[0];
  const norm = person.toLowerCase();
  return (
    rows.find((r) => (r.name ?? "").toLowerCase().includes(norm) || (r.contact_alias ?? "").toLowerCase().includes(norm)) ??
    rows[0]
  );
}

export async function fetchPrimaryContact(partnerId: string): Promise<{ name: string | null; email: string | null }> {
  const { data } = await supabase
    .from("partner_contacts")
    .select("name, contact_alias, email")
    .eq("partner_id", partnerId)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const row = (data ?? [])[0] as { name: string | null; contact_alias: string | null; email: string | null } | undefined;
  if (!row) return { name: null, email: null };
  return { name: row.name ?? row.contact_alias ?? null, email: row.email ?? null };
}

/** Riesegue una query partners usando i filtri salvati nel contesto
 *  (es. city=Amman). Usato dal ramo proceed-with-context come fallback
 *  quando partnerIds non è disponibile. */
export async function fetchPartnersByFilters(
  filters: ReadonlyArray<{ column: string; op: string; value: unknown }>,
): Promise<CommandPartnerRow[]> {
  if (!filters.length) return [];
  // I nomi colonna arrivano da un contesto salvato dal planner (stringhe a
  // runtime): la query passa dall'unico confine sanzionato per le query
  // dinamiche, con whitelist delle colonne filtrabili (fail closed).
  const base = selectFromValidatedTable("partners", PARTNER_COLS)
    .eq("is_active", true)
    .neq("lead_status", "blacklisted")
    .limit(50);
  const { data, error } = await readValidatedRows(
    applyValidatedFilters(base, filters, PARTNER_FILTERABLE_COLUMNS),
    parseCommandPartnerRow,
  );
  if (error) return [];
  return data ?? [];
}
