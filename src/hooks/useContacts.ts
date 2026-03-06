import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/sanitizeSearch";

export type LeadStatus = "new" | "contacted" | "in_progress" | "negotiation" | "converted" | "lost";

export interface ContactFilters {
  search?: string;
  country?: string;
  origin?: string;
  leadStatus?: LeadStatus;
  dateFrom?: string;
  dateTo?: string;
  hasDeepSearch?: boolean;
  hasAlias?: boolean;
  holdingPattern?: "out" | "in" | "all";
  groupBy?: "country" | "origin" | "status" | "date";
  importLogId?: string;
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

const CONTACTS_KEY = ["contacts"] as const;
const INTERACTIONS_KEY = (id: string) => ["contact-interactions", id] as const;
const FILTER_OPTIONS_KEY = ["contacts-filter-options"] as const;

const DEFAULT_PAGE_SIZE = 200;

/** Fetches all distinct origins and countries for filter dropdowns */
export function useContactFilterOptions() {
  return useQuery({
    queryKey: FILTER_OPTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contact_filter_options");
      if (error) throw error;

      const origins: string[] = [];
      const countries: string[] = [];
      (data ?? []).forEach((r: any) => {
        if (r.filter_type === "origin") origins.push(r.filter_value);
        else if (r.filter_type === "country") countries.push(r.filter_value);
      });

      return { origins, countries };
    },
    staleTime: 60_000,
  });
}

export function useContacts(filters: ContactFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: [...CONTACTS_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Quality filter
      q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

      // Group filter (import_log_id)
      if (filters.importLogId) q = q.eq("import_log_id", filters.importLogId);

      if (filters.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          q = q.or(
            `company_name.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%`
          );
        }
      }
      if (filters.country) q = q.eq("country", filters.country);
      if (filters.origin) q = q.eq("origin", filters.origin);
      if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      if (filters.hasDeepSearch === true) q = q.not("deep_search_at", "is", null);
      if (filters.hasDeepSearch === false) q = q.is("deep_search_at", null);
      if (filters.hasAlias === true) q = q.not("company_alias", "is", null);
      if (filters.holdingPattern === "out") q = q.eq("interaction_count", 0);
      else if (filters.holdingPattern === "in") q = q.gt("interaction_count", 0);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
    },
  });
}

/** Contacts that have at least 1 interaction (holding pattern) */
export function useHoldingPatternContacts(filters: ContactFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: ["holding-pattern", filters],
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("*", { count: "exact" })
        .gt("interaction_count", 0)
        .order("last_interaction_at", { ascending: false });

      if (filters.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          q = q.or(
            `company_name.ilike.%${s}%,name.ilike.%${s}%,email.ilike.%${s}%`
          );
        }
      }
      if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
      if (filters.country) q = q.eq("country", filters.country);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data ?? [], totalCount: count ?? 0, page, pageSize };
    },
  });
}

export function useHoldingPatternStats() {
  return useQuery({
    queryKey: ["holding-pattern-stats"],
    queryFn: async () => {
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
    },
  });
}

export function useContactInteractions(contactId: string | null) {
  return useQuery({
    queryKey: contactId ? INTERACTIONS_KEY(contactId) : ["noop"],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_interactions")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContactInteraction[];
    },
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: LeadStatus }) => {
      const updates: Record<string, unknown> = { lead_status: status };
      if (status === "converted") updates.converted_at = new Date().toISOString();
      const { error } = await supabase
        .from("imported_contacts")
        .update(updates)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: ["holding-pattern"] });
    },
  });
}

export function useCreateContactInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interaction: {
      contact_id: string;
      interaction_type: string;
      title: string;
      description?: string;
      outcome?: string;
    }) => {
      const { error: iError } = await supabase
        .from("contact_interactions")
        .insert(interaction);
      if (iError) throw iError;

      // Atomic increment via DB function
      await supabase.rpc("increment_contact_interaction" as any, {
        p_contact_id: interaction.contact_id,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: INTERACTIONS_KEY(vars.contact_id) });
      qc.invalidateQueries({ queryKey: ["holding-pattern"] });
    },
  });
}
