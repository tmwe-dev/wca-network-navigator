/**
 * CampaignsPage — Campaign jobs with real data
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "../molecules/StatCard";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { StatusBadge } from "../atoms/StatusBadge";
import { Send, Clock, CheckCircle, Pause } from "lucide-react";

interface CampaignDraft {
  readonly id: string;
  readonly subject: string | null;
  readonly status: string;
  readonly totalCount: number;
  readonly sentCount: number;
  readonly queueStatus: string;
  readonly createdAt: string;
}

const draftColumns: readonly ColumnDef<CampaignDraft>[] = [
  { id: "subject", header: "Oggetto", accessorFn: (row) => row.subject },
  {
    id: "status", header: "Stato", accessorFn: (row) => row.queueStatus,
    cell: (row) => {
      const map: Record<string, "success" | "warning" | "neutral"> = {
        completed: "success", processing: "warning", idle: "neutral",
      };
      return <StatusBadge status={map[row.queueStatus] ?? "neutral"} label={row.queueStatus} />;
    },
    className: "w-[120px]",
  },
  {
    id: "progress", header: "Progresso",
    accessorFn: (row) => `${row.sentCount}/${row.totalCount}`,
    className: "w-[120px]",
  },
  {
    id: "createdAt", header: "Creato",
    accessorFn: (row) => row.createdAt,
    cell: (row) => new Date(row.createdAt).toLocaleDateString("it-IT"),
    className: "w-[110px]",
  },
];

export function CampaignsPage(): React.ReactElement {
  const { data: stats } = useQuery({
    queryKey: ["v2", "campaign-stats"],
    queryFn: async () => {
      const [sentRes, pendingRes, completedRes] = await Promise.all([
        supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("email_drafts").select("id", { count: "exact", head: true }).eq("queue_status", "completed"),
      ]);
      return {
        sent: sentRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        completed: completedRes.count ?? 0,
      };
    },
  });

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["v2", "campaign-drafts"],
    queryFn: async (): Promise<CampaignDraft[]> => {
      const { data, error } = await supabase
        .from("email_drafts")
        .select("id, subject, status, total_count, sent_count, queue_status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return [];
      return data.map((d) => ({
        id: d.id,
        subject: d.subject,
        status: d.status,
        totalCount: d.total_count,
        sentCount: d.sent_count,
        queueStatus: d.queue_status,
        createdAt: d.created_at,
      }));
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campagne</h1>
        <p className="text-sm text-muted-foreground">Gestione campagne email e outreach.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Inviate" value={stats?.sent ?? 0} icon={<Send className="h-4 w-4" />} />
        <StatCard title="In coda" value={stats?.pending ?? 0} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="Campagne completate" value={stats?.completed ?? 0} icon={<CheckCircle className="h-4 w-4" />} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable
          columns={draftColumns}
          rows={drafts}
          getRowId={(row) => row.id}
          emptyTitle="Nessuna campagna"
          emptyDescription="Crea una nuova campagna dal modulo Outreach."
        />
      )}
    </div>
  );
}
