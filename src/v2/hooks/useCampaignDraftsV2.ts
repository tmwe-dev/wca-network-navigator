/**
 * useCampaignDraftsV2 — Campaign drafts, queue, stats, pause/resume.
 * @deprecated 2026-04-30 — Hook non importato da nessuna pagina.
 * Le bozze batch sono gestite via `useEmailCampaignQueue` nel CampaignQueueMonitor
 * (Command Canvas). Mantenuto in archivio per riferimento.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

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

interface CampaignStats {
  readonly sent: number;
  readonly pending: number;
  readonly completed: number;
}

export function useCampaignStatsV2() {
  return useQuery({
    queryKey: ["v2", "campaign-stats"],
    queryFn: async (): Promise<CampaignStats> => {
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
}

export function useCampaignDraftsV2() {
  return useQuery({
    queryKey: queryKeys.v2.campaignDrafts(),
    queryFn: async (): Promise<readonly CampaignDraft[]> => {
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
}

export function useCampaignQueueV2(draftId: string | null) {
  return useQuery({
    queryKey: ["v2", "campaign-queue-items", draftId],
    enabled: !!draftId,
    queryFn: async (): Promise<readonly QueueItem[]> => {
      if (!draftId) return [];
      const { data, error } = await supabase
        .from("email_campaign_queue")
        .select("id, recipient_email, recipient_name, status, sent_at, error_message")
        .eq("draft_id", draftId)
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
}

export function usePauseCampaignV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from("email_drafts").update({ queue_status: "paused" }).eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.v2.campaignDrafts() });
      toast.success("Campagna in pausa");
    },
  });
}

export function useResumeCampaignV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from("email_drafts").update({ queue_status: "processing" }).eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.v2.campaignDrafts() });
      toast.success("Campagna ripresa");
    },
  });
}

export type { CampaignDraft, QueueItem, CampaignStats };
