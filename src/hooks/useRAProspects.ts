import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { RAContact, RAInteraction } from "@/types/ra";
import type { RAProspect, RAProspectFilters, RALeadStatus } from "@/types/ra";
import { queryKeys } from "@/lib/queryKeys";

const RA_PROSPECTS_KEY = ["ra-prospects"] as const;
const DEFAULT_PAGE_SIZE = 100;

export function useRAProspects(filters: RAProspectFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: [...RA_PROSPECTS_KEY, filters],
    queryFn: async () => {
      let q = untypedFrom("ra_prospects")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (filters.search) {
        const s = filters.search.replace(/%/g, "");
        q = q.or(
          `company_name.ilike.%${s}%,partita_iva.ilike.%${s}%,city.ilike.%${s}%,email.ilike.%${s}%`
        );
      }
      if (filters.atecoCodes?.length) q = q.in("codice_ateco", filters.atecoCodes);
      if (filters.regions?.length) q = q.in("region", filters.regions);
      if (filters.provinces?.length) q = q.in("province", filters.provinces);
      if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
      if (filters.hasEmail) q = q.not("email", "is", null);
      if (filters.hasPec) q = q.not("pec", "is", null);
      if (filters.hasPhone) q = q.not("phone", "is", null);
      if (filters.minFatturato != null) q = q.gte("fatturato", filters.minFatturato);
      if (filters.maxFatturato != null) q = q.lte("fatturato", filters.maxFatturato);
      if (filters.minDipendenti != null) q = q.gte("dipendenti", filters.minDipendenti);
      if (filters.maxDipendenti != null) q = q.lte("dipendenti", filters.maxDipendenti);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = (await q) as {
        data: unknown;
        error: unknown;
        count: unknown;
      };
      if (error) throw error;

      return {
        items: (data ?? []) as RAProspect[],
        totalCount: count ?? 0,
        page,
        pageSize,
      };
    },
    staleTime: 30_000,
  });
}

export function useRAProspect(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prospects.ra.prospect(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = (await untypedFrom("ra_prospects")
        .select("*")
        .eq("id", id)
        .single()) as {
        data: unknown;
        error: unknown;
      };
      if (error) throw error;
      return data as RAProspect;
    },
    enabled: !!id,
  });
}

export function useRAProspectContacts(prospectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prospects.ra.contacts(prospectId),
    queryFn: async () => {
      if (!prospectId) return [];
      const { data, error } = (await untypedFrom("ra_contacts")
        .select("*")
        .eq("prospect_id", prospectId)
        .order("created_at", { ascending: false })) as {
        data: unknown;
        error: unknown;
      };
      if (error) throw error;
      return (data ?? []) as RAContact[];
    },
    enabled: !!prospectId,
  });
}

export function useRAProspectInteractions(prospectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prospects.ra.interactions(prospectId),
    queryFn: async () => {
      if (!prospectId) return [];
      const { data, error } = (await untypedFrom("ra_interactions")
        .select("*")
        .eq("prospect_id", prospectId)
        .order("created_at", { ascending: false })) as {
        data: unknown;
        error: unknown;
      };
      if (error) throw error;
      return (data ?? []) as RAInteraction[];
    },
    enabled: !!prospectId,
  });
}

export function useUpsertRAProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospect: Partial<RAProspect> & { company_name: string }) => {
      if (prospect.partita_iva) {
        const { data: existing } = (await untypedFrom("ra_prospects")
          .select("id")
          .eq("partita_iva", prospect.partita_iva)
          .maybeSingle()) as {
          data: unknown;
        };

        if (existing) {
          const { data, error } = (await untypedFrom("ra_prospects")
            .update({ ...prospect, updated_at: new Date().toISOString() })
            .eq("id", (existing as Record<string, string>).id)
            .select()
            .single()) as {
            data: unknown;
            error: unknown;
          };
          if (error) throw error;
          return data;
        }
      }

      const { data, error } = (await untypedFrom("ra_prospects")
        .insert(prospect)
        .select()
        .single()) as {
        data: unknown;
        error: unknown;
      };
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_PROSPECTS_KEY });
    },
  });
}

export function useUpdateRALeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RALeadStatus }) => {
      // NOTE: ra_prospects is a separate domain with its own lead lifecycle, distinct from the
      // partners/imported_contacts domains. It does not route through the RPC guard since it has
      // its own state machine. This direct write is intentional and not a bypass of lead_status guards.
      const { error } = (await untypedFrom("ra_prospects")
        .update({ lead_status: status, updated_at: new Date().toISOString() })
        .eq("id", id)) as {
        error: unknown;
      };
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_PROSPECTS_KEY });
    },
  });
}

export function useDeleteRAProspects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = (await untypedFrom("ra_prospects")
        .delete()
        .in("id", ids)) as {
        error: unknown;
      };
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_PROSPECTS_KEY });
    },
  });
}
