/**
 * OutreachPage — Activities with filters, actions, create form, detail drawer
 */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActivitiesV2 } from "@/v2/hooks/useActivitiesV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { ActivityDetailDrawer } from "../organisms/ActivityDetailDrawer";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { isOverdue } from "@/v2/core/domain/rules/activity-rules";
import type { Activity, ActivityStatus } from "@/v2/core/domain/entities";
import { Filter, Plus, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateActivityDrawer } from "../organisms/CreateActivityDrawer";

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
const TYPES = ["email", "call", "follow_up", "meeting", "whatsapp_message", "note"] as const;

export function OutreachPage(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: activities = [], isLoading } = useActivitiesV2({
    status: statusFilter,
    limit: 500,
  });

  const filtered = useMemo(() => {
    let result = [...activities];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) => a.title.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
      );
    }
    if (typeFilter) {
      result = result.filter((a) => a.activityType === typeFilter);
    }
    return result;
  }, [activities, searchQuery, typeFilter]);

  const overdue = useMemo(() => activities.filter(isOverdue).length, [activities]);
  const pending = useMemo(() => activities.filter((a) => a.status === "pending").length, [activities]);

  const markCompleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities")
        .update({ status: "completed" as const, completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "activities"] });
      toast.success("Attività completata");
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Caricamento..." : `${filtered.length} attività • ${pending} in attesa • ${overdue} scadute`}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova Attività
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === s ? undefined : s)}
            >
              {s === "pending" ? "In attesa" : s === "in_progress" ? "In corso" : s === "completed" ? "Completate" : "Annullate"}
            </Button>
          ))}
        </div>
        <div className="border-l mx-1" />
        <select
          className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
          value={typeFilter ?? ""}
          onChange={(e) => setTypeFilter(e.target.value || undefined)}
        >
          <option value="">Tutti i tipi</option>
          {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
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
        onMarkComplete={(id) => markCompleteMut.mutate(id)}
      />

      <CreateActivityDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["v2", "activities"] });
          setShowCreate(false);
        }}
      />
    </div>
  );
}
