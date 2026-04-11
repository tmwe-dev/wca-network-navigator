/**
 * OutreachPage — STEP 8
 * Outreach activities list with status grouping.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useActivitiesV2 } from "@/v2/hooks/useActivitiesV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { StatusBadge } from "../atoms/StatusBadge";
import { isOverdue } from "@/v2/core/domain/rules/activity-rules";
import type { Activity } from "@/v2/core/domain/entities";

const activityColumns: readonly ColumnDef<Activity>[] = [
  {
    id: "title",
    header: "Titolo",
    accessorFn: (row) => row.title,
  },
  {
    id: "type",
    header: "Tipo",
    accessorFn: (row) => row.activityType,
    cell: (row) => (
      <StatusBadge
        status="default"
        label={row.activityType.replace(/_/g, " ")}
      />
    ),
    className: "w-[130px]",
  },
  {
    id: "status",
    header: "Stato",
    accessorFn: (row) => row.status,
    cell: (row) => {
      const overdue = isOverdue(row);
      const statusMap: Record<string, "success" | "warning" | "error" | "default"> = {
        completed: "success",
        in_progress: "warning",
        pending: overdue ? "error" : "default",
        cancelled: "default",
      };
      return (
        <StatusBadge
          status={statusMap[row.status] ?? "default"}
          label={overdue ? "Scaduta" : row.status}
        />
      );
    },
    className: "w-[100px]",
  },
  {
    id: "priority",
    header: "Priorità",
    accessorFn: (row) => row.priority,
    className: "w-[90px]",
  },
  {
    id: "dueDate",
    header: "Scadenza",
    accessorFn: (row) => row.dueDate,
    cell: (row) =>
      row.dueDate ? new Date(row.dueDate).toLocaleDateString("it-IT") : "—",
    className: "w-[110px]",
  },
];

export function OutreachPage(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: activities = [], isLoading } = useActivitiesV2({ limit: 200 });

  const filtered = searchQuery
    ? activities.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (a.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : activities;

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

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
        <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} attività
        </p>
      </div>

      <SearchBar onSearch={handleSearch} placeholder="Cerca attività..." />

      <DataTable
        columns={activityColumns}
        rows={[...filtered]}
        getRowId={(row) => String(row.id)}
        emptyTitle="Nessuna attività"
        emptyDescription="La coda outreach è vuota."
      />
    </div>
  );
}
