import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function usePendingTaskCount() {
  const [realtimeCount, setRealtimeCount] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["pending-task-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from("agent_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["pending", "proposed"]);
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("pending-tasks-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_tasks" }, () => {
        query.refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return realtimeCount ?? query.data ?? 0;
}
