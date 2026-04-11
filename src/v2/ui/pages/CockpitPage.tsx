/**
 * CockpitPage — Operative dashboard for agents
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "../atoms/StatusBadge";
import { Gauge, Bot, CheckCircle, Clock } from "lucide-react";
import { StatCard } from "../molecules/StatCard";

export function CockpitPage(): React.ReactElement {
  const { data: queue } = useQuery({
    queryKey: ["v2-cockpit-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cockpit_queue")
        .select("id, source_type, status, partner_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["v2-agent-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select("id, task_type, status, description, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pending = queue?.filter((q) => q.status === "pending").length ?? 0;
  const completed = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const running = tasks?.filter((t) => t.status === "running").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Gauge className="h-6 w-6" />Cockpit</h1>
        <p className="text-sm text-muted-foreground">Dashboard operativa agenti AI.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="In coda" value={String(pending)} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="In esecuzione" value={String(running)} icon={<Bot className="h-4 w-4" />} />
        <StatCard title="Completati" value={String(completed)} icon={<CheckCircle className="h-4 w-4" />} />
      </div>

      {tasks && tasks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Task recenti</h3>
          {tasks.slice(0, 20).map((t) => (
            <div key={t.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground">{t.task_type} • {new Date(t.created_at).toLocaleDateString("it")}</p>
              </div>
              <StatusBadge status={t.status === "completed" ? "success" : t.status === "running" ? "info" : t.status === "failed" ? "error" : "warning"} label={t.status} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
