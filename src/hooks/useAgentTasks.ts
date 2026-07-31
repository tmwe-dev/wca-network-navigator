import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { findAgentTasksList, insertAgentTaskReturning } from "@/data/agentTasks";

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
      return findAgentTasksList(agentId!, 50);
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: Partial<AgentTaskInsert>) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");
      return insertAgentTaskReturning({ ...task, user_id: user.id, agent_id: task.agent_id ?? agentId! } satisfies AgentTaskInsert);
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
