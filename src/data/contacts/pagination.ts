import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";
import type { ContactPaginatedFilters, ContactPaginatedSort } from "./types";

type ContactQuery = any;

export async function findContactsPaginated(
  filters: ContactPaginatedFilters,
  pageParam: number,
  pageSize: number = 50,
) {
  const from = pageParam * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
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
    query = query.order(s.col, {
      ascending: s.asc,
      ...(s.nullsFirst !== undefined ? { nullsFirst: s.nullsFirst } : {}),
    });
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
