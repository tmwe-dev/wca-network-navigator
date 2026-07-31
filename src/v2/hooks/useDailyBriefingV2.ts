/**
 * useDailyBriefingV2 — AI daily briefing for staff
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDailyBriefingsRaw } from "@/v2/io/supabase/queries/daily-briefing";
import { queryKeys } from "@/lib/queryKeys";

interface DailyBriefing {
  readonly id: string;
  readonly agentCode: string;
  readonly content: string;
  readonly briefingType: string | null;
  readonly createdAt: string;
}

export function useDailyBriefingV2() {
  return useQuery({
    queryKey: queryKeys.v2.dailyBriefing,
    queryFn: async (): Promise<readonly DailyBriefing[]> => {
      const { data, error } = await fetchDailyBriefingsRaw();
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        agentCode: r.agent_code,
        content: r.content,
        briefingType: r.briefing_type,
        createdAt: r.created_at ?? new Date().toISOString(),
      }));
    },
  });
}
