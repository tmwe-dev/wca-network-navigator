/**
 * useAgentTasksV2 — Agent tasks for cockpit/missions
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

interface AgentTask {
  readonly id: string;
  readonly agentId: string;
  readonly taskType: string;
  readonly status: string;
  readonly description: string;
  readonly resultSummary: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export function useAgentTasksV2(agentId?: string) {
  return useQuery({
    queryKey: queryKeys.v2.agentTasks(agentId ?? "all"),
    queryFn: async (): Promise<readonly AgentTask[]> => {
      let q = supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }).limit(100);
      if (agentId) q = q.eq("agent_id", agentId);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        agentId: r.agent_id,
        taskType: r.task_type,
        status: r.status,
        description: r.description,
        resultSummary: r.result_summary,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      }));
    },
  });
}
