/**
 * useEmailCampaignQueueV2 — Campaign queue monitor
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CampaignQueueStats {
  readonly pending: number;
  readonly completed: number;
  readonly failed: number;
  readonly total: number;
}

export function useEmailCampaignQueueV2(draftId?: string) {
  return useQuery({
    queryKey: ["v2", "campaign-queue", draftId ?? "global"],
    queryFn: async (): Promise<CampaignQueueStats> => {
      let q = supabase.from("email_campaign_queue").select("status");
      if (draftId) q = q.eq("draft_id", draftId);
      const { data, error } = await q;
      if (error || !data) return { pending: 0, completed: 0, failed: 0, total: 0 };
      const pending = data.filter((r) => r.status === "pending").length;
      const completed = data.filter((r) => r.status === "completed").length;
      const failed = data.filter((r) => r.status === "failed").length;
      return { pending, completed, failed, total: data.length };
    },
    refetchInterval: 5000,
  });
}
