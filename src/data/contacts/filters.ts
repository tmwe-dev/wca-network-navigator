import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { ContactFilters } from "./types";

type ContactQuery = any;

export async function findHoldingPatternContacts(filters: ContactFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 200;

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

  const stats: Record<string, number> = {
    contacted: 0,
    in_progress: 0,
    negotiation: 0,
    converted: 0,
    lost: 0,
    total: 0,
  };
  (data ?? []).forEach((r: { lead_status: string | null }) => {
    stats.total++;
    if (r.lead_status && stats[r.lead_status] !== undefined)
      stats[r.lead_status]++;
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

export async function fetchGroupContactIds(
  groupType: string,
  groupKey: string,
  holdingPattern?: "out" | "in" | "all"
): Promise<string[]> {
  let q = supabase
    .from("imported_contacts")
    .select("id")
    .or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);

  switch (groupType) {
    case "country":
      groupKey === "??" || groupKey === "Sconosciuto"
        ? (q = q.is("country", null))
        : (q = q.eq("country", groupKey));
      break;
    case "origin":
      groupKey === "Sconosciuta"
        ? (q = q.is("origin", null))
        : (q = q.eq("origin", groupKey));
      break;
    case "status":
      q = q.eq("lead_status", groupKey);
      break;
    case "date":
      if (groupKey === "nd") {
        q = q.is("created_at", null);
      } else {
        const [y, m] = groupKey.split("-").map(Number);
        q = q
          .gte("created_at", `${groupKey}-01T00:00:00Z`)
          .lt("created_at", new Date(y, m, 1).toISOString());
      }
      break;
  }

  const { data } = await q.limit(1000);
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function findContactsByGroup(
  groupType: string,
  groupKey: string,
  page: number = 0,
  pageSize: number = 200,
  holdingPattern?: "out" | "in" | "all"
) {
  let q = supabase
    .from("imported_contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);

  switch (groupType) {
    case "country":
      if (groupKey === "??" || groupKey === "Sconosciuto") {
        q = q.is("country", null);
      } else {
        q = q.eq("country", groupKey);
      }
      break;
    case "origin":
      if (groupKey === "Sconosciuta") {
        q = q.is("origin", null);
      } else {
        q = q.eq("origin", groupKey);
      }
      break;
    case "status":
      q = q.eq("lead_status", groupKey);
      break;
    case "date":
      if (groupKey === "nd") {
        q = q.is("created_at", null);
      } else {
        const [y, m] = groupKey.split("-").map(Number);
        q = q
          .gte("created_at", `${groupKey}-01T00:00:00Z`)
          .lt("created_at", new Date(y, m, 1).toISOString());
      }
      break;
  }

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
}
