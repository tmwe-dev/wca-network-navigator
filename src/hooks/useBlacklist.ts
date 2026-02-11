import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlacklistEntry {
  id: string;
  blacklist_no: number | null;
  company_name: string;
  city: string | null;
  country: string | null;
  status: string | null;
  claims: string | null;
  total_owed_amount: number | null;
  matched_partner_id: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlacklistSyncLog {
  id: string;
  sync_type: string;
  entries_count: number;
  matched_count: number;
  created_at: string;
}

export function useBlacklistEntries() {
  return useQuery({
    queryKey: ["blacklist-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_entries" as any)
        .select("*")
        .order("blacklist_no", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BlacklistEntry[];
    },
  });
}

export function useBlacklistSyncLog() {
  return useQuery({
    queryKey: ["blacklist-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_sync_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as BlacklistSyncLog[];
    },
  });
}

export function useBlacklistStats() {
  return useQuery({
    queryKey: ["blacklist-stats"],
    queryFn: async () => {
      const { data: entries, error: e1 } = await supabase
        .from("blacklist_entries" as any)
        .select("id, matched_partner_id");
      if (e1) throw e1;
      const total = entries?.length || 0;
      const matched = entries?.filter((e: any) => e.matched_partner_id).length || 0;

      const { data: logs } = await supabase
        .from("blacklist_sync_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      const lastUpdated = (logs as any)?.[0]?.created_at || null;

      return { total, matched, lastUpdated };
    },
  });
}

export function useBlacklistForPartner(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["blacklist-partner", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_entries" as any)
        .select("*")
        .eq("matched_partner_id", partnerId);
      if (error) throw error;
      return (data || []) as unknown as BlacklistEntry[];
    },
  });
}

export function useBlacklistByPartnerIds(partnerIds: string[]) {
  return useQuery({
    queryKey: ["blacklist-partner-ids", partnerIds.sort().join(",")],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_entries" as any)
        .select("matched_partner_id")
        .not("matched_partner_id", "is", null);
      if (error) throw error;
      const ids = new Set((data || []).map((d: any) => d.matched_partner_id));
      return ids;
    },
  });
}

export function useImportBlacklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[]) => {
      // Delete existing manual entries then insert new ones
      await supabase.from("blacklist_entries" as any).delete().eq("source", "manual");

      // Insert in batches of 50
      for (let i = 0; i < entries.length; i += 50) {
        const batch = entries.slice(i, i + 50);
        const { error } = await supabase.from("blacklist_entries" as any).insert(batch as any);
        if (error) throw error;
      }

      // Match with partners
      const { data: allEntries } = await supabase
        .from("blacklist_entries" as any)
        .select("id, company_name, country");
      const { data: partners } = await supabase
        .from("partners")
        .select("id, company_name, country_name");

      let matchCount = 0;
      if (allEntries && partners) {
        for (const entry of allEntries as any[]) {
          const entryName = (entry.company_name || "").toLowerCase().trim();
          const entryCountry = (entry.country || "").toLowerCase().trim();

          const match = partners.find((p: any) => {
            const pName = (p.company_name || "").toLowerCase().trim();
            const pCountry = (p.country_name || "").toLowerCase().trim();
            const nameMatch = pName === entryName || pName.includes(entryName) || entryName.includes(pName);
            const countryMatch = pCountry === entryCountry || pCountry.includes(entryCountry) || entryCountry.includes(pCountry);
            return nameMatch && countryMatch;
          });

          if (match) {
            await supabase
              .from("blacklist_entries" as any)
              .update({ matched_partner_id: match.id } as any)
              .eq("id", entry.id);
            matchCount++;
          }
        }
      }

      // Log sync
      await supabase.from("blacklist_sync_log" as any).insert({
        sync_type: "manual_import",
        entries_count: entries.length,
        matched_count: matchCount,
      } as any);

      return { imported: entries.length, matched: matchCount };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blacklist-entries"] });
      qc.invalidateQueries({ queryKey: ["blacklist-stats"] });
      qc.invalidateQueries({ queryKey: ["blacklist-sync-log"] });
      qc.invalidateQueries({ queryKey: ["blacklist-partner-ids"] });
    },
  });
}
