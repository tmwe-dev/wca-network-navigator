import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface AgentWithTasks {
  id: string;
  name: string;
  role: string;
  avatar_emoji: string;
  is_active: boolean;
  tasks: AgentTaskRow[];
}

export interface AgentTaskRow {
  id: string;
  agent_id: string;
  task_type: string;
  description: string;
  status: string;
  result_summary: string | null;
  execution_log: unknown[];
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  target_filters: unknown;
}

export function useAgentDashboard() {
  const agentsQuery = useQuery({
    queryKey: ["agent-dashboard-agents"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, role, avatar_emoji, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at");
      return (agents ?? []) as Array<{ id: string; name: string; role: string; avatar_emoji: string; is_active: boolean }>;
    },
    staleTime: 5 * 60_000,
  });

  const tasksQuery = useQuery({
    queryKey: ["agent-dashboard-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as AgentTaskRow[];
    },
    refetchInterval: 15_000,
  });

  // Realtime refresh
  useEffect(() => {
    const ch = supabase
      .channel("agent-dash-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, () => {
        tasksQuery.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const agents = agentsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  const agentsWithTasks: AgentWithTasks[] = agents.map(a => ({
    ...a,
    tasks: tasks.filter(t => t.agent_id === a.id),
  }));

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending" || t.status === "proposed").length,
    running: tasks.filter(t => t.status === "running").length,
    completed: tasks.filter(t => t.status === "completed").length,
    failed: tasks.filter(t => t.status === "failed").length,
  };

  return {
    agents: agentsWithTasks,
    tasks,
    stats,
    isLoading: agentsQuery.isLoading || tasksQuery.isLoading,
    refetch: () => { agentsQuery.refetch(); tasksQuery.refetch(); },
  };
}
