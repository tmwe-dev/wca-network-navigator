/**
 * useCockpitLogicV2 — Cockpit queue and agent task orchestration
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

interface CockpitItem {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly partnerId: string | null;
  readonly status: string;
  readonly createdAt: string;
}

export function useCockpitLogicV2() {
  return useQuery({
    queryKey: queryKeys.v2.cockpit(),
    queryFn: async (): Promise<readonly CockpitItem[]> => {
      const { data, error } = await supabase
        .from("cockpit_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        sourceType: r.source_type,
        sourceId: r.source_id,
        partnerId: r.partner_id,
        status: r.status,
        createdAt: r.created_at,
      }));
    },
  });
}
