import { supabase } from "@/integrations/supabase/client";
import type { ContactRow, PartnerRow } from "./types";

const PARTNER_COLS = "id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at";

export async function searchPartnersByCountry(countryCode: string): Promise<PartnerRow[]> {
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLS)
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .neq("lead_status", "blacklisted")
    .order("company_name")
    .limit(50);
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

export async function fetchPartnersByIds(ids: ReadonlyArray<string>): Promise<PartnerRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_COLS)
    .in("id", ids as string[])
    .eq("is_active", true)
    .neq("lead_status", "blacklisted");
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

export async function searchPartner(company: string | null, email: string | null): Promise<PartnerRow[]> {
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
  return (data ?? []) as PartnerRow[];
}

export async function findContact(partnerId: string, person: string | null, email: string | null): Promise<ContactRow | null> {
  let q = supabase
    .from("partner_contacts")
    .select("id, partner_id, name, contact_alias, email, title")
    .eq("partner_id", partnerId)
    .limit(5);
  if (email) q = q.eq("email", email);
  const { data } = await q;
  const rows = (data ?? []) as ContactRow[];
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
): Promise<PartnerRow[]> {
  if (!filters.length) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: unknown = supabase
    .from("partners")
    .select(PARTNER_COLS)
    .eq("is_active", true)
    .neq("lead_status", "blacklisted")
    .limit(50);
  for (const f of filters) {
    switch (f.op) {
      case "eq": q = q.eq(f.column, f.value); break;
      case "neq": q = q.neq(f.column, f.value); break;
      case "ilike": q = q.ilike(f.column, `%${String(f.value).replace(/%/g, "")}%`); break;
      case "in":
        if (Array.isArray(f.value)) q = q.in(f.column, f.value as (string | number)[]);
        break;
      case "is": q = q.is(f.column, f.value as null | boolean); break;
    }
  }
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}