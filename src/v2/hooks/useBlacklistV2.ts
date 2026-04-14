/**
 * useBlacklistV2 — Blacklist entries
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

interface BlacklistEntry {
  readonly id: string;
  readonly companyName: string;
  readonly country: string | null;
  readonly city: string | null;
  readonly status: string | null;
  readonly source: string | null;
  readonly matchedPartnerId: string | null;
  readonly totalOwedAmount: number | null;
}

export function useBlacklistV2() {
  return useQuery({
    queryKey: queryKeys.v2.blacklist,
    queryFn: async (): Promise<readonly BlacklistEntry[]> => {
      const { data, error } = await supabase
        .from("blacklist_entries")
        .select("*")
        .order("company_name");
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        companyName: r.company_name,
        country: r.country,
        city: r.city,
        status: r.status,
        source: r.source,
        matchedPartnerId: r.matched_partner_id,
        totalOwedAmount: r.total_owed_amount,
      }));
    },
  });
}
