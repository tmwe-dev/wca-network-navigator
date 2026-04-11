/**
 * useDailyBriefingV2 — AI daily briefing for staff
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DailyBriefing {
  readonly id: string;
  readonly agentCode: string;
  readonly content: string;
  readonly briefingType: string | null;
  readonly createdAt: string;
}

export function useDailyBriefingV2() {
  return useQuery({
    queryKey: ["v2", "daily-briefing"],
    queryFn: async (): Promise<readonly DailyBriefing[]> => {
      const { data, error } = await supabase
        .from("ai_session_briefings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
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
