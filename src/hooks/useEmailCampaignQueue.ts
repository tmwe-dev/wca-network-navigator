import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("useEmailCampaignQueue");

type QueueRow = Database["public"]["Tables"]["email_campaign_queue"]["Row"];
type QueueInsert = Database["public"]["Tables"]["email_campaign_queue"]["Insert"];

export type QueueItem = QueueRow;

export interface QueueStats {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
}

export function useEmailCampaignQueue(draftId: string | null) {
  const qc = useQueryClient();

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["email-campaign-queue", draftId],
    queryFn: async () => {
      if (!draftId) return [];
      const { data, error } = await supabase
        .from("email_campaign_queue")
        .select("*")
        .eq("draft_id", draftId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!draftId,
    refetchInterval: false,
  });

  const stats: QueueStats = {
    total: items.length,
    pending: items.filter(i => i.status === "pending").length,
    sending: items.filter(i => i.status === "sending").length,
    sent: items.filter(i => i.status === "sent").length,
    failed: items.filter(i => i.status === "failed").length,
    cancelled: items.filter(i => i.status === "cancelled").length,
  };

  // Realtime subscription
  useEffect(() => {
    if (!draftId) return;
    const channel = supabase
      .channel(`queue-${draftId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "email_campaign_queue",
        filter: `draft_id=eq.${draftId}`,
      }, () => {
        refetchItems();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [draftId, refetchItems]);

  return { items, stats, refetchItems };
}

export function useEnqueueCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      recipients: Array<{ partner_id: string; email: string; name?: string; subject: string; html: string }>;
      delaySeconds: number;
    }) => {
      // Insert queue items
      const rows: QueueInsert[] = params.recipients.map((r, i) => ({
        draft_id: params.draftId,
        partner_id: r.partner_id,
        recipient_email: r.email,
        recipient_name: r.name || null,
        subject: r.subject,
        html_body: r.html,
        status: "pending",
        position: i,
      }));

      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from("email_campaign_queue").insert(batch);
        if (error) throw error;
      }

      // Update draft
      await supabase.from("email_drafts").update({
        queue_status: "idle",
        queue_delay_seconds: params.delaySeconds,
        total_count: params.recipients.length,
        sent_count: 0,
        status: "queued",
      }).eq("id", params.draftId);

      return { queued: rows.length };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-campaign-queue"] });
      qc.invalidateQueries({ queryKey: ["email-drafts"] });
      toast.success(`${data.queued} email in coda`);
    },
    onError: () => toast.error("Errore nell'accodamento"),
  });
}

export function useProcessQueue() {
  const [processing, setProcessing] = useState(false);
  const abortRef = useRef(false);
  const qc = useQueryClient();

  const startProcessing = useCallback(async (draftId: string) => {
    setProcessing(true);
    abortRef.current = false;

    let completed = false;
    while (!completed && !abortRef.current) {
      try {
        const data = await invokeEdge<{ completed?: boolean; sent?: number; failed?: number }>("process-email-queue", {
          body: { draft_id: draftId, action: "process" },
          context: "useEmailCampaignQueue.process",
        });

        if (data?.completed) {
          completed = true;
          toast.success(`Campagna completata: ${data.sent} inviate, ${data.failed} fallite`);
        }

        // Check if paused
        const { data: draft } = await supabase
          .from("email_drafts")
          .select("queue_status")
          .eq("id", draftId)
          .single();
        if (draft?.queue_status === "paused" || draft?.queue_status === "cancelled") {
          break;
        }

        // Delay between batch invocations to avoid hammering the server
        if (!completed) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err) {
        log.error("queue processing failed", { message: err instanceof Error ? err.message : String(err) });
        toast.error("Errore nel processing della coda");
        break;
      }
    }

    setProcessing(false);
    qc.invalidateQueries({ queryKey: ["email-drafts"] });
  }, [qc]);

  const pauseProcessing = useCallback(async (draftId: string) => {
    abortRef.current = true;
    try {
      await invokeEdge("process-email-queue", {
        body: { draft_id: draftId, action: "pause" },
        context: "useEmailCampaignQueue.pause",
      });
    } catch (err) {
      log.warn("pause failed", { message: err instanceof Error ? err.message : String(err) });
    }
    qc.invalidateQueries({ queryKey: ["email-drafts"] });
    toast.info("Campagna in pausa");
  }, [qc]);

  const cancelProcessing = useCallback(async (draftId: string) => {
    abortRef.current = true;
    try {
      await invokeEdge("process-email-queue", {
        body: { draft_id: draftId, action: "cancel" },
        context: "useEmailCampaignQueue.cancel",
      });
    } catch (err) {
      log.warn("cancel failed", { message: err instanceof Error ? err.message : String(err) });
    }
    qc.invalidateQueries({ queryKey: ["email-drafts"] });
    qc.invalidateQueries({ queryKey: ["email-campaign-queue"] });
    toast.info("Campagna annullata");
  }, [qc]);

  return { processing, startProcessing, pauseProcessing, cancelProcessing };
}
