/**
 * React Query hooks for Contacts — thin wrappers around src/data/contacts.ts
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  findContacts,
  findHoldingPatternContacts,
  getHoldingPatternStats,
  getContactFilterOptions,
  findContactInteractions,
  updateLeadStatus,
  createContactInteraction,
  contactKeys,
  invalidateContactCache,
} from "@/data/contacts";
import type { ContactFilters, ContactInteraction, LeadStatus } from "@/data/contacts";
import { queryKeys } from "@/lib/queryKeys";

// Re-export types for backward compat
export type { ContactFilters, ContactInteraction, LeadStatus };

export function useContactFilterOptions() {
  return useQuery({
    queryKey: contactKeys.filterOptions,
    queryFn: getContactFilterOptions,
    staleTime: 60_000,
  });
}

export function useContacts(filters: ContactFilters = {}) {
  return useQuery({
    queryKey: contactKeys.filtered(filters),
    queryFn: () => findContacts(filters),
  });
}

export function useHoldingPatternContacts(filters: ContactFilters = {}) {
  return useQuery({
    queryKey: queryKeys.contacts.holdingPattern,
    queryFn: () => findHoldingPatternContacts(filters),
  });
}

export function useHoldingPatternStats() {
  return useQuery({
    queryKey: contactKeys.holdingPatternStats,
    queryFn: getHoldingPatternStats,
  });
}

export function useContactInteractions(contactId: string | null) {
  return useQuery({
    queryKey: contactId ? contactKeys.interactions(contactId) : ["noop"],
    enabled: !!contactId,
    queryFn: () => findContactInteractions(contactId!),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: LeadStatus }) => {
      await updateLeadStatus(ids, status);
    },
    onSuccess: () => invalidateContactCache(qc),
  });
}

export function useCreateContactInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createContactInteraction,
    onSuccess: (_d, vars) => {
      invalidateContactCache(qc);
      qc.invalidateQueries({ queryKey: contactKeys.interactions(vars.contact_id) });
    },
  });
}
