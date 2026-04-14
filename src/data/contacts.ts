/**
 * Data Access Layer — Imported Contacts
 * Single source of truth for all imported_contacts table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

// ─── Types ──────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "in_progress" | "negotiation" | "converted" | "lost";

type ImportedContactRow = Database["public"]["Tables"]["imported_contacts"]["Row"];
type ImportedContactInsert = Database["public"]["Tables"]["imported_contacts"]["Insert"];

export interface ContactFilters {
  search?: string;
  country?: string;
  countries?: string[];
  origin?: string;
  origins?: string[];
  leadStatus?: LeadStatus;
  dateFrom?: string;
  dateTo?: string;
  hasDeepSearch?: boolean;
  hasAlias?: boolean;
  holdingPattern?: "out" | "in" | "all";
  groupBy?: "country" | "origin" | "status" | "date";
  importLogId?: string;
  metPersonally?: boolean;
  channel?: string;
  quality?: string;
  wcaMatch?: "matched" | "unmatched" | "all";
  page?: number;
  pageSize?: number;
}

export interface ContactInteraction {
  id: string;
  contact_id: string;
  interaction_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  created_at: string;
  created_by: string | null;
}

// ─── Query Keys ─────────────────────────────────────────
export const contactKeys = {
  all: ["contacts"] as const,
  filtered: (f: ContactFilters) => ["contacts", f] as const,
  interactions: (id: string) => ["contact-interactions", id] as const,
  filterOptions: ["contacts-filter-options"] as const,
  holdingPattern: queryKeys.contacts.holdingPattern as const,
  holdingPatternStats: ["holding-pattern-stats"] as const,
};

// ─── Constants ──────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 200;

// ─── Query Builder type ─────────────────────────────────
// The Supabase query builder is complex with generics; we use a lightweight
// escape hatch to preserve chainability without importing the full generic type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- query builder chain
type ContactQuery = any;

// ─── Query Helpers ──────────────────────────────────────

function applyContactFilters(
  q: ContactQuery,
  filters: ContactFilters
): ContactQuery {
  // Quality filter — base
  q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (filters.importLogId) q = q.eq("import_log_id", filters.importLogId);

  if (filters.search) {
    const s = sanitizeSearchTerm(filters.search);
    if (s) {
      q = q.or(
        `company_name.ilike.%${s}%,company_alias.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,country.ilike.%${s}%,position.ilike.%${s}%,origin.ilike.%${s}%,phone.ilike.%${s}%,mobile.ilike.%${s}%`
      );
    }
  }
  if (filters.countries?.length) q = q.in("country", filters.countries);
  else if (filters.country) q = q.eq("country", filters.country);

  if (filters.origins?.length) q = q.in("origin", filters.origins);
  else if (filters.origin) q = q.eq("origin", filters.origin);

  if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
  if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
  if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
  if (filters.hasDeepSearch === true) q = q.not("deep_search_at", "is", null);
  if (filters.hasDeepSearch === false) q = q.is("deep_search_at", null);
  if (filters.hasAlias === true) q = q.not("company_alias", "is", null);
  if (filters.holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (filters.holdingPattern === "in") q = q.gt("interaction_count", 0);

  if (filters.channel === "with_email") q = q.not("email", "is", null);
  else if (filters.channel === "with_phone") q = q.not("phone", "is", null);

  if (filters.quality === "enriched") q = q.not("deep_search_at", "is", null);
  else if (filters.quality === "not_enriched") q = q.is("deep_search_at", null);
  else if (filters.quality === "with_alias") q = q.not("company_alias", "is", null);
  else if (filters.quality === "no_alias") q = q.is("company_alias", null);

  if (filters.wcaMatch === "matched") q = q.not("wca_partner_id", "is", null);
  else if (filters.wcaMatch === "unmatched") q = q.is("wca_partner_id", null);

  return q;
}

// ─── Queries ────────────────────────────────────────────

export async function findContacts(filters: ContactFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  let q = supabase
    .from("imported_contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  q = applyContactFilters(q, filters);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
}

export async function findHoldingPatternContacts(filters: ContactFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  let q = supabase
    .from("imported_contacts")
    .select("*", { count: "exact" })
    .gt("interaction_count", 0)
    .order("last_interaction_at", { ascending: false });

  if (filters.search) {
    const s = sanitizeSearchTerm(filters.search);
    if (s) q = q.or(`company_name.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%`);
  }
  if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
  if (filters.country) q = q.eq("country", filters.country);

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
}

export async function getHoldingPatternStats() {
  const { data, error } = await supabase
    .from("imported_contacts")
    .select("lead_status", { count: "exact" })
    .gt("interaction_count", 0);
  if (error) throw error;

  const stats: Record<string, number> = { contacted: 0, in_progress: 0, negotiation: 0, converted: 0, lost: 0, total: 0 };
  (data ?? []).forEach((r: { lead_status: string | null }) => {
    stats.total++;
    if (r.lead_status && stats[r.lead_status] !== undefined) stats[r.lead_status]++;
  });
  return stats;
}

export async function getContactFilterOptions() {
  const { data, error } = await supabase.rpc("get_contact_filter_options");
  if (error) throw error;

  const origins: string[] = [];
  const countries: string[] = [];
  (data ?? []).forEach((r: { filter_type: string; filter_value: string }) => {
    if (r.filter_type === "origin") origins.push(r.filter_value);
    else if (r.filter_type === "country") countries.push(r.filter_value);
  });
  return { origins, countries };
}

export async function findContactInteractions(contactId: string): Promise<ContactInteraction[]> {
  const { data, error } = await supabase
    .from("contact_interactions")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContactInteraction[];
}

export async function updateLeadStatus(ids: string[], status: LeadStatus) {
  const updates: Record<string, unknown> = { lead_status: status };
  if (status === "converted") updates.converted_at = new Date().toISOString();
  const { error } = await supabase
    .from("imported_contacts")
    .update(updates)
    .in("id", ids);
  if (error) throw error;
}

export async function createContactInteraction(interaction: {
  contact_id: string;
  interaction_type: string;
  title: string;
  description?: string;
  outcome?: string;
}) {
  const { error: iError } = await supabase
    .from("contact_interactions")
    .insert(interaction);
  if (iError) throw iError;

  await supabase.rpc("increment_contact_interaction", {
    p_contact_id: interaction.contact_id,
  });
}

export async function deleteContacts(ids: string[]) {
  const { error } = await supabase
    .from("imported_contacts")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function updateContact(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from("imported_contacts")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

// ─── Additional Queries ────────────────────────────────

export async function getContactById(id: string) {
  const { data, error } = await supabase
    .from("imported_contacts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getContactsByIds(ids: string[], select = "id, name, company_name, email") {
  // Dynamic select requires flexible return type for diverse consumers
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .from("imported_contacts")
      .select(select)
      .in("id", batch);
    if (error) throw error;
    if (data) results.push(...(data as unknown as Record<string, unknown>[]));
  }
  return results;
}

export async function insertContacts(contacts: Record<string, unknown>[]) {
  for (let i = 0; i < contacts.length; i += 100) {
    const { error } = await supabase.from("imported_contacts").insert(contacts.slice(i, i + 100) as ImportedContactInsert[]);
    if (error) throw error;
  }
}

export async function toggleContactSelection(id: string, selected: boolean) {
  const { error } = await supabase
    .from("imported_contacts")
    .update({ is_selected: selected })
    .eq("id", id);
  if (error) throw error;
}

export async function markContactTransferred(id: string) {
  const { error } = await supabase
    .from("imported_contacts")
    .update({ is_transferred: true })
    .eq("id", id);
  if (error) throw error;
}

export async function findContactByEmail(email: string) {
  const { data, error } = await supabase
    .from("imported_contacts")
    .select("company_name, company_alias, name, contact_alias, country")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateContactEnrichment(id: string, enrichmentPatch: Record<string, unknown>) {
  const { data } = await supabase
    .from("imported_contacts")
    .select("enrichment_data")
    .eq("id", id)
    .single();
  const existing = ((data?.enrichment_data as Record<string, unknown>) ?? {});
  const merged = structuredClone({ ...existing, ...enrichmentPatch });
  const { error } = await supabase
    .from("imported_contacts")
    .update({ enrichment_data: merged as unknown as ImportedContactRow["enrichment_data"] })
    .eq("id", id);
  if (error) throw error;
}

export async function updateContactStatus(id: string, status: string, extra?: Record<string, unknown>) {
  const updates: Record<string, unknown> = { lead_status: status, ...extra };
  const { error } = await supabase
    .from("imported_contacts")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function fetchGroupContactIds(groupType: string, groupKey: string, holdingPattern?: "out" | "in" | "all"): Promise<string[]> {
  let q = supabase.from("imported_contacts").select("id").or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);
  switch (groupType) {
    case "country": groupKey === "??" || groupKey === "Sconosciuto" ? q = q.is("country", null) : q = q.eq("country", groupKey); break;
    case "origin": groupKey === "Sconosciuta" ? q = q.is("origin", null) : q = q.eq("origin", groupKey); break;
    case "status": q = q.eq("lead_status", groupKey); break;
    case "date":
      if (groupKey === "nd") q = q.is("created_at", null);
      else { const [y, m] = groupKey.split("-").map(Number); q = q.gte("created_at", `${groupKey}-01T00:00:00Z`).lt("created_at", new Date(y, m, 1).toISOString()); }
      break;
  }
  const { data } = await q.limit(1000);
  return (data ?? []).map((r: { id: string }) => r.id);
}

// ─── Paginated query for CRM (infinite scroll) ────────

export type ContactPaginatedSort = "company_asc" | "company_desc" | "name_asc" | "name_desc" | "city_asc" | "city_desc" | "country_asc" | "country_desc" | "origin_asc" | "origin_desc" | "recent";

export interface ContactPaginatedFilters {
  search?: string;
  countries?: string[];
  origins?: string[];
  cities?: string[];
  companies?: string[];
  names?: string[];
  leadStatus?: string;
  channel?: string;
  quality?: string;
  wcaMatch?: "matched" | "unmatched" | "all";
  holdingPattern?: "out" | "in" | "all";
  importLogId?: string;
  sort?: ContactPaginatedSort | string;
}

export async function findContactsPaginated(
  filters: ContactPaginatedFilters,
  pageParam: number,
  pageSize: number = 50,
) {
  const from = pageParam * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- query builder chain
  let query: any = supabase
    .from("imported_contacts")
    .select("*", { count: "exact" });

  query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (filters.search) {
    const s = sanitizeSearchTerm(filters.search);
    if (s) {
      query = query.or(
        `company_name.ilike.%${s}%,company_alias.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,country.ilike.%${s}%,position.ilike.%${s}%,origin.ilike.%${s}%,phone.ilike.%${s}%,mobile.ilike.%${s}%`
      );
    }
  }

  if (filters.countries?.length) query = query.in("country", filters.countries);
  if (filters.origins?.length) query = query.in("origin", filters.origins);
  if (filters.cities?.length) query = query.in("city", filters.cities);
  if (filters.companies?.length) query = query.in("company_name", filters.companies);
  if (filters.names?.length) query = query.in("name", filters.names);
  if (filters.leadStatus) query = query.eq("lead_status", filters.leadStatus);
  if (filters.importLogId) query = query.eq("import_log_id", filters.importLogId);

  if (filters.holdingPattern === "out") query = query.or("interaction_count.eq.0,interaction_count.is.null");
  else if (filters.holdingPattern === "in") query = query.gt("interaction_count", 0);

  if (filters.channel === "with_email") query = query.not("email", "is", null);
  else if (filters.channel === "with_phone") query = query.not("phone", "is", null);

  if (filters.quality === "enriched") query = query.not("deep_search_at", "is", null);
  else if (filters.quality === "not_enriched") query = query.is("deep_search_at", null);
  else if (filters.quality === "with_alias") query = query.not("company_alias", "is", null);
  else if (filters.quality === "no_alias") query = query.is("company_alias", null);

  if (filters.wcaMatch === "matched") query = query.not("wca_partner_id", "is", null);
  else if (filters.wcaMatch === "unmatched") query = query.is("wca_partner_id", null);

  const sort = filters.sort || "company_asc";
  const sortMap: Record<string, Array<{ col: string; asc: boolean; nullsFirst?: boolean }>> = {
    company_asc: [{ col: "company_name", asc: true, nullsFirst: false }, { col: "name", asc: true }],
    company_desc: [{ col: "company_name", asc: false, nullsFirst: true }, { col: "name", asc: true }],
    name_asc: [{ col: "name", asc: true, nullsFirst: false }, { col: "company_name", asc: true }],
    name_desc: [{ col: "name", asc: false, nullsFirst: true }, { col: "company_name", asc: true }],
    city_asc: [{ col: "city", asc: true, nullsFirst: false }, { col: "company_name", asc: true }],
    city_desc: [{ col: "city", asc: false, nullsFirst: true }, { col: "company_name", asc: true }],
    country_asc: [{ col: "country", asc: true, nullsFirst: false }, { col: "company_name", asc: true }],
    country_desc: [{ col: "country", asc: false, nullsFirst: true }, { col: "company_name", asc: true }],
    origin_asc: [{ col: "origin", asc: true, nullsFirst: false }, { col: "company_name", asc: true }],
    origin_desc: [{ col: "origin", asc: false, nullsFirst: true }, { col: "company_name", asc: true }],
    recent: [{ col: "created_at", asc: false }],
  };
  for (const s of sortMap[sort] ?? sortMap.company_asc) {
    query = query.order(s.col, { ascending: s.asc, ...(s.nullsFirst !== undefined ? { nullsFirst: s.nullsFirst } : {}) });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    contacts: data || [],
    total: count ?? 0,
    page: pageParam,
    hasMore: (data?.length || 0) === pageSize,
  };
}

// ─── Grouped query for contact groups ──────────────────

export async function findContactsByGroup(
  groupType: string,
  groupKey: string,
  page: number = 0,
  pageSize: number = 200,
  holdingPattern?: "out" | "in" | "all",
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- query builder chain
  let q: any = supabase
    .from("imported_contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);

  switch (groupType) {
    case "country":
      if (groupKey === "??" || groupKey === "Sconosciuto") q = q.is("country", null);
      else q = q.eq("country", groupKey);
      break;
    case "origin":
      if (groupKey === "Sconosciuta") q = q.is("origin", null);
      else q = q.eq("origin", groupKey);
      break;
    case "status":
      q = q.eq("lead_status", groupKey);
      break;
    case "date":
      if (groupKey === "nd") {
        q = q.is("created_at", null);
      } else {
        const [y, m] = groupKey.split("-").map(Number);
        q = q.gte("created_at", `${groupKey}-01T00:00:00Z`).lt("created_at", new Date(y, m, 1).toISOString());
      }
      break;
  }

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
}

// ─── Business card matched to contact ──────────────────

export async function findBusinessCardForContact(contactId: string) {
  const { data, error } = await supabase
    .from("business_cards")
    .select("photo_url, event_name, met_at, location")
    .eq("matched_contact_id", contactId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Cache Invalidation ────────────────────────────────
export function invalidateContactCache(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: contactKeys.all });
  qc.invalidateQueries({ queryKey: contactKeys.holdingPattern });
}
