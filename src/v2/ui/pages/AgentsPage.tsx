/**
 * AgentsPage — Agent cards with detail drawer and task history
 */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgentsV2 } from "@/v2/hooks/useAgentsV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { AgentDetailDrawer } from "../organisms/AgentDetailDrawer";
import { StatusBadge } from "../atoms/StatusBadge";
import { StatCard } from "../molecules/StatCard";
import { agentReadinessScore } from "@/v2/core/domain/rules/agent-rules";
import { Bot, CheckCircle, Clock, AlertTriangle, Zap } from "lucide-react";
import type { Agent } from "@/v2/core/domain/entities";

const agentColumns: readonly ColumnDef<Agent>[] = [
  {
    id: "avatar", header: "", accessorFn: (row) => row.avatarEmoji,
    cell: (row) => <span className="text-xl">{row.avatarEmoji}</span>,
    sortable: false, className: "w-[50px]",
  },
  { id: "name", header: "Nome", accessorFn: (row) => row.name },
  { id: "role", header: "Ruolo", accessorFn: (row) => row.role },
  {
    id: "territories", header: "Territori",
    accessorFn: (row) => row.territoryCodes.length > 0 ? row.territoryCodes.join(", ") : "Globale",
  },
  {
    id: "status", header: "Stato", accessorFn: (row) => (row.isActive ? "Attivo" : "Inattivo"),
    cell: (row) => <StatusBadge status={row.isActive ? "success" : "neutral"} label={row.isActive ? "Attivo" : "Inattivo"} />,
    className: "w-[100px]",
  },
  {
    id: "readiness", header: "Prontezza", accessorFn: (row) => agentReadinessScore(row),
    cell: (row) => {
      const score = agentReadinessScore(row);
      const status = score >= 70 ? "success" : score >= 40 ? "warning" : "error";
      return <StatusBadge status={status} label={`${score}%`} />;
    },
    className: "w-[90px]",
  },
];

export function AgentsPage(): React.ReactElement {
  const { data: agents = [], isLoading } = useAgentsV2();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["v2-agent-tasks-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select("id, task_type, status, description, agent_id, created_at, completed_at, result_summary")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(String(a.id), a));
    return map;
  }, [agents]);

  const stats = useMemo(() => {
    const active = agents.filter((a) => a.isActive).length;
    const completed = tasks?.filter((t) => t.status === "completed").length ?? 0;
    const running = tasks?.filter((t) => t.status === "running").length ?? 0;
    const failed = tasks?.filter((t) => t.status === "failed").length ?? 0;
    return { active, completed, running, failed };
  }, [agents, tasks]);

  const handleRowClick = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenti AI</h1>
        <p className="text-sm text-muted-foreground">{agents.length} agenti configurati</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Attivi" value={String(stats.active)} icon={<Bot className="h-4 w-4" />} />
        <StatCard title="Task in corso" value={String(stats.running)} icon={<Zap className="h-4 w-4" />} />
        <StatCard title="Completati" value={String(stats.completed)} icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard title="Falliti" value={String(stats.failed)} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <DataTable
        columns={agentColumns}
        rows={[...agents]}
        getRowId={(row) => String(row.id)}
        emptyTitle="Nessun agente"
        emptyDescription="Configura il tuo primo agente AI."
        onRowClick={handleRowClick}
      />

      {/* Recent tasks */}
      {tasks && tasks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> Task recenti
          </h3>
          <div className="space-y-2">
            {tasks.slice(0, 15).map((t) => {
              const agent = agentMap.get(t.agent_id);
              return (
                <div key={t.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {agent ? <span className="text-lg">{agent.avatarEmoji}</span> : null}
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
              );
            })}
          </div>
        </div>
      ) : null}

      <AgentDetailDrawer
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}
