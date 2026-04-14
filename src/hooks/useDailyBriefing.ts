import { useQuery } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";

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

export interface BriefingStats {
  totalContacts: number;
  inHolding: number;
  notContacted: number;
  scheduledToday: number;
}

export interface DailyBriefing {
  /** Legacy single summary (fallback) */
  summary?: string;
  /** 3-tab sections */
  completed: string;
  todo: string;
  suspended: string;
  actions: BriefingAction[];
  agentStatus: AgentStatusItem[];
  stats: BriefingStats;
}

export function useDailyBriefing() {
  return useQuery<DailyBriefing>({
    queryKey: queryKeys.dailyBriefing.all,
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      return invokeEdge<DailyBriefing>("daily-briefing", { context: "useDailyBriefing" });
    },
  });
}
