/**
 * OutreachPage — Activities with filters, detail drawer
 */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { useActivitiesV2 } from "@/v2/hooks/useActivitiesV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { ActivityDetailDrawer } from "../organisms/ActivityDetailDrawer";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { isOverdue } from "@/v2/core/domain/rules/activity-rules";
import type { Activity, ActivityStatus } from "@/v2/core/domain/entities";
import { Filter } from "lucide-react";

const activityColumns: readonly ColumnDef<Activity>[] = [
  { id: "title", header: "Titolo", accessorFn: (row) => row.title },
  {
    id: "type", header: "Tipo", accessorFn: (row) => row.activityType,
    cell: (row) => <StatusBadge status="neutral" label={row.activityType.replace(/_/g, " ")} />,
    className: "w-[130px]",
  },
  {
    id: "status", header: "Stato", accessorFn: (row) => row.status,
    cell: (row) => {
      const overdue = isOverdue(row);
      const map: Record<string, "success" | "warning" | "error" | "neutral"> = {
        completed: "success", in_progress: "warning", pending: overdue ? "error" : "neutral", cancelled: "neutral",
      };
      return <StatusBadge status={map[row.status] ?? "neutral"} label={overdue ? "Scaduta" : row.status} />;
    },
    className: "w-[100px]",
  },
  { id: "priority", header: "Priorità", accessorFn: (row) => row.priority, className: "w-[90px]" },
  {
    id: "dueDate", header: "Scadenza", accessorFn: (row) => row.dueDate,
    cell: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString("it-IT") : "—",
    className: "w-[110px]",
  },
];

const STATUSES: ActivityStatus[] = ["pending", "in_progress", "completed", "cancelled"];

export function OutreachPage(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | undefined>();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const { data: activities = [], isLoading } = useActivitiesV2({
    status: statusFilter,
    limit: 500,
  });

  const filtered = useMemo(() => {
    if (!searchQuery) return [...activities];
    const q = searchQuery.toLowerCase();
    return activities.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
    );
  }, [activities, searchQuery]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Caricamento..." : `${filtered.length} attività`}
          </p>
        </div>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === s ? undefined : s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <SearchBar onSearch={setSearchQuery} placeholder="Cerca attività..." />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={activityColumns}
          rows={filtered}
          getRowId={(row) => String(row.id)}
          emptyTitle="Nessuna attività"
          emptyDescription="La coda outreach è vuota."
          onRowClick={setSelectedActivity}
        />
      )}

      <ActivityDetailDrawer
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  );
}
