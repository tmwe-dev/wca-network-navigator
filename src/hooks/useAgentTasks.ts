import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface AgentTask {
  id: string;
  agent_id: string;
  user_id: string;
  task_type: string;
  description: string;
  target_filters: any;
  status: string;
  result_summary: string | null;
  execution_log: any[];
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useAgentTasks(agentId?: string) {
  const qc = useQueryClient();
  const key = ["agent-tasks", agentId] as const;

  const query = useQuery({
    queryKey: key,
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tasks" as any)
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as AgentTask[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: Partial<AgentTask>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agent_tasks" as any)
        .insert({ ...task, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AgentTask;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const executeTask = useMutation({
    mutationFn: async (taskId: string) => {
      return invokeEdge<unknown>("agent-execute", {
        body: { agent_id: agentId, task_id: taskId },
        context: "useAgentTasks.executeTask",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { tasks: query.data ?? [], isLoading: query.isLoading, createTask, executeTask };
}
