/**
 * CockpitPage — Operative dashboard with queue management and agent task control
 */
import * as React from "react";
import { useMemo } from "react";
import { useCockpitLogicV2 } from "@/v2/hooks/useCockpitLogicV2";
import { useAgentTasksV2 } from "@/v2/hooks/useAgentTasksV2";
import { useAgentsV2 } from "@/v2/hooks/useAgentsV2";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { Gauge, Bot, CheckCircle, Clock, Trash2 } from "lucide-react";
import { StatCard } from "../molecules/StatCard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CockpitPage(): React.ReactElement {
  const qc = useQueryClient();
  const { data: queue } = useCockpitLogicV2();
  const { data: tasks } = useAgentTasksV2();
  const { data: agents } = useAgentsV2();

  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string }>();
    agents?.forEach((a) => map.set(a.id, { name: a.name, emoji: a.avatarEmoji }));
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
      qc.invalidateQueries({ queryKey: ["v2", "cockpit-queue"] });
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
                    <td className="px-4 py-2 text-foreground">{q.sourceType}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={q.status === "pending" ? "warning" : q.status === "completed" ? "success" : "info"} label={q.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleDateString("it")}</td>
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

      {tasks && tasks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Task agenti recenti</h3>
          <div className="space-y-2">
            {tasks.slice(0, 20).map((t) => {
              const agent = agentMap.get(t.agentId);
              return (
                <div key={t.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {agent ? <span>{agent.emoji}</span> : null}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent?.name ?? "Agente"} • {t.taskType} • {new Date(t.createdAt).toLocaleDateString("it")}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={t.status === "completed" ? "success" : t.status === "running" ? "info" : t.status === "failed" ? "error" : "warning"}
                      label={t.status}
                    />
                  </div>
                  {t.resultSummary ? (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{t.resultSummary}</p>
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
