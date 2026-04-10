import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BlacklistEntryRow = Database["public"]["Tables"]["blacklist_entries"]["Row"];
type BlacklistEntryInsert = Database["public"]["Tables"]["blacklist_entries"]["Insert"];
type BlacklistSyncLogRow = Database["public"]["Tables"]["blacklist_sync_log"]["Row"];
type BlacklistSyncLogInsert = Database["public"]["Tables"]["blacklist_sync_log"]["Insert"];

export type BlacklistEntry = BlacklistEntryRow;
export type BlacklistSyncLog = BlacklistSyncLogRow;

export function useBlacklistEntries() {
  return useQuery({
    queryKey: ["blacklist-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_entries")
        .select("*")
        .order("blacklist_no", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBlacklistSyncLog() {
  return useQuery({
    queryKey: ["blacklist-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBlacklistStats() {
  return useQuery({
    queryKey: ["blacklist-stats"],
    queryFn: async () => {
      const { data: entries, error: e1 } = await supabase
        .from("blacklist_entries")
        .select("id, matched_partner_id");
      if (e1) throw e1;
      const total = entries?.length || 0;
      const matched = entries?.filter(e => e.matched_partner_id).length || 0;

      const { data: logs } = await supabase
        .from("blacklist_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      const lastUpdated = logs?.[0]?.created_at ?? null;

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
        .from("blacklist_entries")
        .select("*")
        .eq("matched_partner_id", partnerId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBlacklistByPartnerIds(partnerIds: string[]) {
  return useQuery({
    queryKey: ["blacklist-partner-ids", partnerIds.sort().join(",")],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blacklist_entries")
        .select("matched_partner_id")
        .not("matched_partner_id", "is", null);
      if (error) throw error;
      const ids = new Set((data ?? []).map(d => d.matched_partner_id as string));
      return ids;
    },
  });
}

export function useImportBlacklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[]) => {
      // Delete existing manual entries then insert new ones
      await supabase.from("blacklist_entries").delete().eq("source", "manual");

      // Insert in batches of 50
      for (let i = 0; i < entries.length; i += 50) {
        const batch = entries.slice(i, i + 50) as BlacklistEntryInsert[];
        const { error } = await supabase.from("blacklist_entries").insert(batch);
        if (error) throw error;
      }

      // Match with partners
      const { data: allEntries } = await supabase
        .from("blacklist_entries")
        .select("id, company_name, country");
      const { data: partners } = await supabase
        .from("partners")
        .select("id, company_name, country_name");

      let matchCount = 0;
      if (allEntries && partners) {
        for (const entry of allEntries) {
          const entryName = (entry.company_name || "").toLowerCase().trim();
          const entryCountry = (entry.country || "").toLowerCase().trim();

          const match = partners.find(p => {
            const pName = (p.company_name || "").toLowerCase().trim();
            const pCountry = (p.country_name || "").toLowerCase().trim();
            const nameMatch = pName === entryName || pName.includes(entryName) || entryName.includes(pName);
            const countryMatch = pCountry === entryCountry || pCountry.includes(entryCountry) || entryCountry.includes(pCountry);
            return nameMatch && countryMatch;
          });

          if (match) {
            await supabase
              .from("blacklist_entries")
              .update({ matched_partner_id: match.id })
              .eq("id", entry.id);
            matchCount++;
          }
        }
      }

      // Log sync
      await supabase.from("blacklist_sync_log").insert({
        sync_type: "manual_import",
        entries_count: entries.length,
        matched_count: matchCount,
      } satisfies BlacklistSyncLogInsert);

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
