/**
 * AgentsPage — STEP 8
 * List of AI agents with readiness score.
 */

import * as React from "react";
import { useAgentsV2 } from "@/v2/hooks/useAgentsV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { StatusBadge } from "../atoms/StatusBadge";
import { agentReadinessScore } from "@/v2/core/domain/rules/agent-rules";
import type { Agent } from "@/v2/core/domain/entities";

const agentColumns: readonly ColumnDef<Agent>[] = [
  {
    id: "avatar",
    header: "",
    accessorFn: (row) => row.avatarEmoji,
    cell: (row) => <span className="text-xl">{row.avatarEmoji}</span>,
    sortable: false,
    className: "w-[50px]",
  },
  {
    id: "name",
    header: "Nome",
    accessorFn: (row) => row.name,
  },
  {
    id: "role",
    header: "Ruolo",
    accessorFn: (row) => row.role,
  },
  {
    id: "territories",
    header: "Territori",
    accessorFn: (row) =>
      row.territoryCodes.length > 0
        ? row.territoryCodes.join(", ")
        : "Globale",
  },
  {
    id: "status",
    header: "Stato",
    accessorFn: (row) => (row.isActive ? "Attivo" : "Inattivo"),
    cell: (row) => (
      <StatusBadge
        status={row.isActive ? "success" : "default"}
        label={row.isActive ? "Attivo" : "Inattivo"}
      />
    ),
    className: "w-[100px]",
  },
  {
    id: "readiness",
    header: "Prontezza",
    accessorFn: (row) => agentReadinessScore(row),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenti AI</h1>
        <p className="text-sm text-muted-foreground">
          {agents.length} agenti configurati
        </p>
      </div>

      <DataTable
        columns={agentColumns}
        rows={[...agents]}
        getRowId={(row) => String(row.id)}
        emptyTitle="Nessun agente"
        emptyDescription="Configura il tuo primo agente AI."
      />
    </div>
  );
}
