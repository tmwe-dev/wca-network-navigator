import { useQuery } from "@tanstack/react-query";
import { rpcGetContactGroupCounts } from "@/data/rpc";
import { findContactsByGroup } from "@/data/contacts";

export interface ContactGroupCount {
  group_type: string;
  group_key: string;
  group_label: string;
  contact_count: number;
  with_email: number;
  with_phone: number;
  with_deep_search: number;
  with_alias: number;
}

const GROUP_COUNTS_KEY = ["contact-group-counts"] as const;

/** Fetches group counts for ALL contacts from the database via RPC */
export function useContactGroupCounts() {
  return useQuery({
    queryKey: GROUP_COUNTS_KEY,
    queryFn: async () => {
      const data = await rpcGetContactGroupCounts();
      return (data ?? []) as ContactGroupCount[];
    },
    staleTime: 30_000,
  });
}

/** Returns contacts for a specific group value, with pagination */
export function useContactsByGroup(
  groupType: string | null,
  groupKey: string | null,
  page: number = 0,
  pageSize: number = 200,
  enabled: boolean = false,
  holdingPattern?: "out" | "in" | "all"
) {
  return useQuery({
    queryKey: ["contacts-by-group", groupType, groupKey, page, pageSize, holdingPattern],
    enabled: enabled && !!groupType && !!groupKey,
    queryFn: async () => {
      return findContactsByGroup(groupType!, groupKey!, page, pageSize, holdingPattern);
    },
  });
}
