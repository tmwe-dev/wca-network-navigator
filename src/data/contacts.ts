/**
 * Data Access Layer — Imported Contacts
 * Single source of truth for all imported_contacts table queries.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { QueryClient } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "in_progress" | "negotiation" | "converted" | "lost";

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
  holdingPattern: ["holding-pattern"] as const,
  holdingPatternStats: ["holding-pattern-stats"] as const,
};

// ─── Constants ──────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 200;

// ─── Query Helpers ──────────────────────────────────────

function applyContactFilters(
  q: any,
  filters: ContactFilters
) {
  // Quality filter — base
  q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null") as any;

  if (filters.importLogId) q = q.eq("import_log_id", filters.importLogId) as any;

  if (filters.search) {
    const s = sanitizeSearchTerm(filters.search);
    if (s) {
      q = q.or(
        `company_name.ilike.%${s}%,company_alias.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,country.ilike.%${s}%,position.ilike.%${s}%,origin.ilike.%${s}%,phone.ilike.%${s}%,mobile.ilike.%${s}%`
      ) as any;
    }
  }
  if (filters.countries?.length) q = q.in("country", filters.countries) as any;
  else if (filters.country) q = q.eq("country", filters.country) as any;

  if (filters.origins?.length) q = q.in("origin", filters.origins) as any;
  else if (filters.origin) q = q.eq("origin", filters.origin) as any;

  if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus) as any;
  if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom) as any;
  if (filters.dateTo) q = q.lte("created_at", filters.dateTo) as any;
  if (filters.hasDeepSearch === true) q = q.not("deep_search_at", "is", null) as any;
  if (filters.hasDeepSearch === false) q = q.is("deep_search_at", null) as any;
  if (filters.hasAlias === true) q = q.not("company_alias", "is", null) as any;
  if (filters.holdingPattern === "out") q = q.eq("interaction_count", 0) as any;
  else if (filters.holdingPattern === "in") q = q.gt("interaction_count", 0) as any;

  if (filters.channel === "with_email") q = q.not("email", "is", null) as any;
  else if (filters.channel === "with_phone") q = q.not("phone", "is", null) as any;

  if (filters.quality === "enriched") q = q.not("deep_search_at", "is", null) as any;
  else if (filters.quality === "not_enriched") q = q.is("deep_search_at", null) as any;
  else if (filters.quality === "with_alias") q = q.not("company_alias", "is", null) as any;
  else if (filters.quality === "no_alias") q = q.is("company_alias", null) as any;

  if (filters.wcaMatch === "matched") q = q.not("wca_partner_id", "is", null) as any;
  else if (filters.wcaMatch === "unmatched") q = q.is("wca_partner_id", null) as any;

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

  q = applyContactFilters(q, filters) as any;

  const from = page * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to) as any;

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
  (data ?? []).forEach((r: any) => {
    stats.total++;
    if (stats[r.lead_status] !== undefined) stats[r.lead_status]++;
  });
  return stats;
}

export async function getContactFilterOptions() {
  const { data, error } = await supabase.rpc("get_contact_filter_options");
  if (error) throw error;

  const origins: string[] = [];
  const countries: string[] = [];
  (data ?? []).forEach((r: any) => {
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

  await supabase.rpc("increment_contact_interaction" as any, {
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

// ─── Cache Invalidation ────────────────────────────────
export function invalidateContactCache(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: contactKeys.all });
  qc.invalidateQueries({ queryKey: contactKeys.holdingPattern });
}
