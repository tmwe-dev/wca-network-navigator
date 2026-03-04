import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  groupBy?: "country" | "origin" | "status" | "date";
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

export function useContacts(filters: ContactFilters = {}) {
  return useQuery({
    queryKey: [...CONTACTS_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.search) {
        q = q.or(
          `company_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        );
      }
      if (filters.country) q = q.eq("country", filters.country);
      if (filters.origin) q = q.eq("origin", filters.origin);
      if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      if (filters.hasDeepSearch === true) q = q.not("deep_search_at", "is", null);
      if (filters.hasDeepSearch === false) q = q.is("deep_search_at", null);
      if (filters.hasAlias === true) q = q.not("company_alias", "is", null);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
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
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
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

      // bump interaction_count & last_interaction_at
      const { data: current } = await supabase
        .from("imported_contacts")
        .select("interaction_count")
        .eq("id", interaction.contact_id)
        .single();

      await supabase
        .from("imported_contacts")
        .update({
          interaction_count: ((current?.interaction_count as number) ?? 0) + 1,
          last_interaction_at: new Date().toISOString(),
        })
        .eq("id", interaction.contact_id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: INTERACTIONS_KEY(vars.contact_id) });
    },
  });
}
