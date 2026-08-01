import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteRAProspects,
  findRAContacts,
  findRAInteractions,
  findRAProspectById,
  findRAProspects,
  updateRALeadStatus,
  upsertRAProspect,
  type RAProspectUpsert,
} from "@/data/reportAziende";
import type { RAProspectFilters, RALeadStatus } from "@/types/ra";
import { queryKeys } from "@/lib/queryKeys";

const RA_PROSPECTS_KEY = ["ra-prospects"] as const;

export function useRAProspects(filters: RAProspectFilters = {}) {
  return useQuery({
    queryKey: [...RA_PROSPECTS_KEY, filters],
    queryFn: () => findRAProspects(filters),
    staleTime: 30_000,
  });
}

export function useRAProspect(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prospects.ra.prospect(id),
    queryFn: () => (id ? findRAProspectById(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useRAProspectContacts(prospectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prospects.ra.contacts(prospectId),
    queryFn: () => (prospectId ? findRAContacts(prospectId) : Promise.resolve([])),
    enabled: !!prospectId,
  });
}

export function useRAProspectInteractions(prospectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prospects.ra.interactions(prospectId),
    queryFn: () => (prospectId ? findRAInteractions(prospectId) : Promise.resolve([])),
    enabled: !!prospectId,
  });
}

export function useUpsertRAProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prospect: RAProspectUpsert) => upsertRAProspect(prospect),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_PROSPECTS_KEY });
    },
  });
}

export function useUpdateRALeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RALeadStatus }) =>
      updateRALeadStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_PROSPECTS_KEY });
    },
  });
}

export function useDeleteRAProspects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteRAProspects(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_PROSPECTS_KEY });
    },
  });
}
