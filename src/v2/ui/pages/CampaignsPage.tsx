/**
 * CampaignsPage — Campaign management with create, pause/resume, detail
 */
import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "../molecules/StatCard";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { Send, Clock, CheckCircle, Pause, Play, Eye, X } from "lucide-react";
import { toast } from "sonner";

interface CampaignDraft {
  readonly id: string;
  readonly subject: string | null;
  readonly status: string;
  readonly totalCount: number;
  readonly sentCount: number;
  readonly queueStatus: string;
  readonly queueDelaySeconds: number;
  readonly createdAt: string;
}

interface QueueItem {
  readonly id: string;
  readonly recipientEmail: string;
  readonly recipientName: string | null;
  readonly status: string;
  readonly sentAt: string | null;
  readonly errorMessage: string | null;
}

export function CampaignsPage(): React.ReactElement {
  const [selectedDraft, setSelectedDraft] = useState<CampaignDraft | null>(null);
  const qc = useQueryClient();

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
        .select("id, subject, status, total_count, sent_count, queue_status, queue_delay_seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !data) return [];
      return data.map((d) => ({
        id: d.id, subject: d.subject, status: d.status,
        totalCount: d.total_count, sentCount: d.sent_count,
        queueStatus: d.queue_status, queueDelaySeconds: d.queue_delay_seconds,
        createdAt: d.created_at,
      }));
    },
  });

  // Queue items for selected draft
  const { data: queueItems } = useQuery({
    queryKey: ["v2", "campaign-queue", selectedDraft?.id],
    enabled: !!selectedDraft,
    queryFn: async (): Promise<QueueItem[]> => {
      if (!selectedDraft) return [];
      const { data, error } = await supabase
        .from("email_campaign_queue")
        .select("id, recipient_email, recipient_name, status, sent_at, error_message")
        .eq("draft_id", selectedDraft.id)
        .order("position", { ascending: true })
        .limit(200);
      if (error || !data) return [];
      return data.map((q) => ({
        id: q.id, recipientEmail: q.recipient_email,
        recipientName: q.recipient_name, status: q.status,
        sentAt: q.sent_at, errorMessage: q.error_message,
      }));
    },
  });

  const pauseMut = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from("email_drafts")
        .update({ queue_status: "paused" })
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "campaign-drafts"] });
      toast.success("Campagna in pausa");
    },
  });

  const resumeMut = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from("email_drafts")
        .update({ queue_status: "processing" })
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "campaign-drafts"] });
      toast.success("Campagna ripresa");
    },
  });

  const statusMap: Record<string, "success" | "warning" | "neutral" | "info" | "error"> = {
    completed: "success", processing: "warning", paused: "info", idle: "neutral", failed: "error",
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campagne</h1>
            <p className="text-sm text-muted-foreground">Gestione campagne email e outreach.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Inviate" value={stats?.sent ?? 0} icon={<Send className="h-4 w-4" />} />
            <StatCard title="In coda" value={stats?.pending ?? 0} icon={<Clock className="h-4 w-4" />} />
            <StatCard title="Completate" value={stats?.completed ?? 0} icon={<CheckCircle className="h-4 w-4" />} />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nessuna campagna</p>
              <p className="text-xs text-muted-foreground mt-1">Crea una campagna dal modulo Outreach o Email Composer.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Oggetto</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Progresso</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id} className={`border-t cursor-pointer hover:bg-accent/30 ${selectedDraft?.id === d.id ? "bg-accent" : ""}`} onClick={() => setSelectedDraft(d)}>
                      <td className="px-4 py-2 text-foreground">{d.subject ?? "(Senza oggetto)"}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${d.totalCount > 0 ? (d.sentCount / d.totalCount * 100) : 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{d.sentCount}/{d.totalCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={statusMap[d.queueStatus] ?? "neutral"} label={d.queueStatus} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {d.queueStatus === "processing" ? (
                            <Button variant="ghost" size="sm" onClick={() => pauseMut.mutate(d.id)}>
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          ) : d.queueStatus === "paused" ? (
                            <Button variant="ghost" size="sm" onClick={() => resumeMut.mutate(d.id)}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Queue detail panel */}
      {selectedDraft && queueItems ? (
        <div className="w-80 border-l bg-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <p className="font-semibold text-sm text-foreground truncate">{selectedDraft.subject ?? "Campagna"}</p>
            <button onClick={() => setSelectedDraft(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {queueItems.map((q) => (
              <div key={q.id} className="px-3 py-2 border-b text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground truncate">{q.recipientName ?? q.recipientEmail}</span>
                  <StatusBadge
                    status={q.status === "sent" ? "success" : q.status === "failed" ? "error" : "warning"}
                    label={q.status}
                  />
                </div>
                <p className="text-muted-foreground truncate">{q.recipientEmail}</p>
                {q.errorMessage ? <p className="text-destructive mt-0.5">{q.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
