/**
 * useContactsV2 — STEP 7
 */

import { useQuery } from "@tanstack/react-query";
import { fetchContacts, fetchContactById } from "@/v2/io/supabase/queries/contacts";
import { isOk } from "@/v2/core/domain/result";
import type { Contact } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";

export interface ContactFilters {
  readonly searchQuery?: string;
  readonly leadStatus?: string;
  readonly importLogId?: string;
}

export function useContactsV2(filters: ContactFilters = {}) {
  return useQuery({
    queryKey: queryKeys.v2.contacts(filters),
    queryFn: async (): Promise<readonly Contact[]> => {
      const contactResult = await fetchContacts({
        search: filters.searchQuery,
        leadStatus: filters.leadStatus,
        importLogId: filters.importLogId,
        limit: 500,
      });

      if (isOk(contactResult)) return contactResult.value;
      return [];
    },
  });
}

export function useContactDetail(contactId: string | null) {
  return useQuery({
    queryKey: queryKeys.v2.contact(contactId),
    queryFn: async (): Promise<Contact | null> => {
      if (!contactId) return null;
      const contactResult = await fetchContactById(contactId);
      if (isOk(contactResult)) return contactResult.value;
      return null;
    },
    enabled: !!contactId,
  });
}
