import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { ContactFilters, LeadStatus, ImportedContactInsert, ImportedContactRow } from "./types";


import { createLogger } from "@/lib/log";
const log = createLogger("queries");
type ContactQuery = any;

function applyContactFilters(
  q: ContactQuery,
  filters: ContactFilters
): ContactQuery {
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

const DEFAULT_PAGE_SIZE = 200;

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

export async function updateContact(id: string, updates: Record<string, unknown>) {
  // GUARD: strip lead_status from generic updates — must go through updateLeadStatus() / RPC
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lead_status: _stripped, ...safeUpdates } = updates;
  if (_stripped !== undefined) {
    log.warn("[updateContact] lead_status stripped from generic update — use updateLeadStatus() instead");
  }
  const { error } = await supabase
    .from("imported_contacts")
    .update(safeUpdates as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteContacts(ids: string[]) {
  const { error } = await supabase
    .from("imported_contacts")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function insertContacts(contacts: Record<string, unknown>[]) {
  for (let i = 0; i < contacts.length; i += 100) {
    const { error } = await supabase.from("imported_contacts").insert(contacts.slice(i, i + 100) as ImportedContactInsert[]);
    if (error) throw error;
  }
}

export async function updateContactStatus(id: string, status: string, extra?: Record<string, unknown>) {
  // P3.7: apply_lead_status_rpc non esiste a DB. UPDATE diretto.
  const { error } = await supabase
    .from("imported_contacts")
    .update({ lead_status: status })
    .eq("id", id);
  if (error) throw error;

  // Apply additional non-status updates if provided
  if (extra && Object.keys(extra).length > 0) {
    const { error: updateError } = await supabase
      .from("imported_contacts")
      .update(extra as never)
      .eq("id", id);
    if (updateError) throw updateError;
  }
}

export async function updateLeadStatus(ids: string[], status: LeadStatus) {
  // P3.7: UPDATE bulk diretto (RPC apply_lead_status_rpc non esiste a DB).
  const { error: bulkErr } = await supabase
    .from("imported_contacts")
    .update({ lead_status: status })
    .in("id", ids);
  if (bulkErr) throw bulkErr;

  // Handle converted_at timestamp if needed
  if (status === "converted") {
    const { error } = await supabase
      .from("imported_contacts")
      .update({ converted_at: new Date().toISOString() })
      .in("id", ids);
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

/**
 * P5.2 — soft-link al partner creato dopo il transfer.
 * Mai delete fisica (mem://constraints/no-physical-delete).
 */
export async function linkContactToPartner(id: string, partnerId: string) {
  const { error } = await supabase
    .from("imported_contacts")
    .update({
      is_transferred: true,
      transferred_to_partner_id: partnerId,
      transferred_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  if (error) throw error;
}

/**
 * P5.1 — Dedup lookup all'import. Ritorna match per email + company_name.
 */
export type ImportDuplicateMatch = {
  match_email: string | null;
  match_company: string | null;
  imported_contact_id: string | null;
  partner_id: string | null;
  source: "imported_contact" | "partner" | "partner_company";
};

export async function findImportDuplicates(
  userId: string,
  emails: string[],
  companyNames: string[],
): Promise<ImportDuplicateMatch[]> {
  const { data, error } = await supabase.rpc("find_import_duplicates" as never, {
    p_user_id: userId,
    p_emails: emails,
    p_company_names: companyNames,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as ImportDuplicateMatch[];
}

export async function updateContactEnrichment(id: string, enrichmentPatch: Record<string, unknown>) {
  const { data } = await supabase
    .from("imported_contacts")
    .select("enrichment_data")
    .eq("id", id)
    .single();
  const existing = (data?.enrichment_data as Record<string, unknown>) ?? {};
  const merged = structuredClone({ ...existing, ...enrichmentPatch });
  const { error } = await supabase
    .from("imported_contacts")
    .update({ enrichment_data: merged as unknown as ImportedContactRow["enrichment_data"] })
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
