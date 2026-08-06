/**
 * useCampaignDraftsV2 — Campaign drafts, queue, stats, pause/resume
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { fetchCampaignStatsCounts } from "@/data/campaignStats";
import { findCampaignDrafts, findCampaignQueueItemsForDraft, setCampaignDraftQueueStatus } from "@/data/emailCampaigns";

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
    queryFn: (): Promise<CampaignStats> => fetchCampaignStatsCounts(),
  });
}

export function useCampaignDraftsV2() {
  return useQuery({
    queryKey: queryKeys.v2.campaignDrafts(),
    queryFn: async (): Promise<readonly CampaignDraft[]> => {
      let data;
      try {
        data = await findCampaignDrafts(50);
      } catch {
        return [];
      }
      return data.map((d) => ({
        id: d.id,
        subject: d.subject,
        status: d.status,
        totalCount: d.total_count,
        sentCount: d.sent_count,
        queueStatus: d.queue_status,
        queueDelaySeconds: d.queue_delay_seconds,
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
      let data;
      try {
        data = await findCampaignQueueItemsForDraft(draftId, 200);
      } catch {
        return [];
      }
      return data.map((q) => ({
        id: q.id,
        recipientEmail: q.recipient_email,
        recipientName: q.recipient_name,
        status: q.status,
        sentAt: q.sent_at,
        errorMessage: q.error_message,
      }));
    },
  });
}

export function usePauseCampaignV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      await setCampaignDraftQueueStatus(draftId, "paused");
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
      await setCampaignDraftQueueStatus(draftId, "processing");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.v2.campaignDrafts() });
      toast.success("Campagna ripresa");
    },
  });
}

export type { CampaignDraft, QueueItem, CampaignStats };
