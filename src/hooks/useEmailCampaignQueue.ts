import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("useEmailCampaignQueue");

export interface QueueItem {
  id: string;
  draft_id: string;
  partner_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  position: number;
  created_at: string;
}

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
        .from("email_campaign_queue" as any)
        .select("*")
        .eq("draft_id", draftId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as QueueItem[];
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
      const rows = params.recipients.map((r, i) => ({
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
        const { error } = await supabase.from("email_campaign_queue" as any).insert(batch as any);
        if (error) throw error;
      }

      // Update draft
      await supabase.from("email_drafts" as any).update({
        queue_status: "idle",
        queue_delay_seconds: params.delaySeconds,
        total_count: params.recipients.length,
        sent_count: 0,
        status: "queued",
      } as any).eq("id", params.draftId);

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
        const { data, error } = await supabase.functions.invoke("process-email-queue", {
          body: { draft_id: draftId, action: "process" },
        });
        if (error) throw error;

        if (data?.completed) {
          completed = true;
          toast.success(`Campagna completata: ${data.sent} inviate, ${data.failed} fallite`);
        }

        // Check if paused
        const { data: draft } = await supabase
          .from("email_drafts" as any)
          .select("queue_status")
          .eq("id", draftId)
          .single();
        if ((draft as any)?.queue_status === "paused" || (draft as any)?.queue_status === "cancelled") {
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
    await supabase.functions.invoke("process-email-queue", {
      body: { draft_id: draftId, action: "pause" },
    });
    qc.invalidateQueries({ queryKey: ["email-drafts"] });
    toast.info("Campagna in pausa");
  }, [qc]);

  const cancelProcessing = useCallback(async (draftId: string) => {
    abortRef.current = true;
    await supabase.functions.invoke("process-email-queue", {
      body: { draft_id: draftId, action: "cancel" },
    });
    qc.invalidateQueries({ queryKey: ["email-drafts"] });
    qc.invalidateQueries({ queryKey: ["email-campaign-queue"] });
    toast.info("Campagna annullata");
  }, [qc]);

  return { processing, startProcessing, pauseProcessing, cancelProcessing };
}
