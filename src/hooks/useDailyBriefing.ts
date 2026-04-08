import { useQuery } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface BriefingAction {
  label: string;
  agentName: string | null;
  prompt: string;
}

export interface AgentStatusItem {
  id: string;
  name: string;
  emoji: string;
  activeTasks: number;
  completedToday: number;
  lastTask: string | null;
}

export interface DailyBriefing {
  summary: string;
  actions: BriefingAction[];
  agentStatus: AgentStatusItem[];
}

export function useDailyBriefing() {
  return useQuery<DailyBriefing>({
    queryKey: ["daily-briefing"],
    staleTime: 15 * 60 * 1000, // 15 min cache
    queryFn: async () => {
      return invokeEdge<DailyBriefing>("daily-briefing", { context: "useDailyBriefing" });
    },
  });
}
