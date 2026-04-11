/**
 * CockpitPage — Operative dashboard with queue management and agent task control
 */
import * as React from "react";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { Gauge, Bot, CheckCircle, Clock, Trash2, Play } from "lucide-react";
import { StatCard } from "../molecules/StatCard";
import { toast } from "sonner";

export function CockpitPage(): React.ReactElement {
  const qc = useQueryClient();

  const { data: queue } = useQuery({
    queryKey: ["v2-cockpit-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cockpit_queue")
        .select("id, source_type, source_id, status, partner_id, created_at")
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
        .select("id, task_type, status, description, agent_id, created_at, completed_at, result_summary")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["v2-agents-for-cockpit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id, name, avatar_emoji").limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string }>();
    agents?.forEach((a) => map.set(a.id, { name: a.name, emoji: a.avatar_emoji }));
    return map;
  }, [agents]);

  const pending = queue?.filter((q) => q.status === "pending").length ?? 0;
  const completed = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const running = tasks?.filter((t) => t.status === "running").length ?? 0;
  const failed = tasks?.filter((t) => t.status === "failed").length ?? 0;

  const removeFromQueueMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cockpit_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2-cockpit-queue"] });
      toast.success("Rimosso dalla coda");
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Gauge className="h-6 w-6" />Cockpit</h1>
        <p className="text-sm text-muted-foreground">Dashboard operativa agenti AI.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="In coda" value={String(pending)} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="In esecuzione" value={String(running)} icon={<Bot className="h-4 w-4" />} />
        <StatCard title="Completati" value={String(completed)} icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard title="Falliti" value={String(failed)} icon={<Trash2 className="h-4 w-4" />} />
      </div>

      {/* Queue */}
      {queue && queue.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Coda operativa ({queue.length})</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground w-20">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id} className="border-t">
                    <td className="px-4 py-2 text-foreground">{q.source_type}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={q.status === "pending" ? "warning" : q.status === "completed" ? "success" : "info"} label={q.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString("it")}</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm" onClick={() => removeFromQueueMut.mutate(q.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Recent agent tasks */}
      {tasks && tasks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Task agenti recenti</h3>
          <div className="space-y-2">
            {tasks.slice(0, 20).map((t) => {
              const agent = agentMap.get(t.agent_id);
              return (
                <div key={t.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {agent ? <span>{agent.emoji}</span> : null}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent?.name ?? "Agente"} • {t.task_type} • {new Date(t.created_at).toLocaleDateString("it")}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={t.status === "completed" ? "success" : t.status === "running" ? "info" : t.status === "failed" ? "error" : "warning"}
                      label={t.status}
                    />
                  </div>
                  {t.result_summary ? (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{t.result_summary}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
