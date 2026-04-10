import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdge } from "@/lib/api/invokeEdge";

type AgentTaskRow = Database["public"]["Tables"]["agent_tasks"]["Row"];
type AgentTaskInsert = Database["public"]["Tables"]["agent_tasks"]["Insert"];

export type AgentTask = AgentTaskRow;

export function useAgentTasks(agentId?: string) {
  const qc = useQueryClient();
  const key = ["agent-tasks", agentId] as const;

  const query = useQuery({
    queryKey: key,
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: Partial<AgentTaskInsert>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({ ...task, user_id: user.id, agent_id: task.agent_id ?? agentId! } satisfies AgentTaskInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
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
