/**
 * useOutreachQueue — coda automatica di invio outreach.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isApiError } from "@/lib/api/apiError";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useTrackActivity } from "@/hooks/useTrackActivity";
import { createLogger } from "@/lib/log";
import { toast } from "@/hooks/use-toast";
import type { ActivityType } from "@/types/tracking";
import { findPendingOutreachItems, updateOutreachItem, getOutreachItemField } from "@/data/outreachQueue";

const log = createLogger("useOutreachQueue");

interface QueueItem {
  id: string;
  channel: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_linkedin_url: string | null;
  subject: string | null;
  body: string;
  status: string;
  attempts: number;
  max_attempts: number;
  priority: number;
  created_by: string | null;
}

const CHANNEL_DELAYS: Record<string, number> = {
  whatsapp: 5000,
  linkedin: 10000,
  email: 2000,
  sms: 3000,
};

function channelToActivityType(channel: string): ActivityType {
  if (channel === "email") return "send_email";
  if (channel === "whatsapp") return "whatsapp_message";
  return "linkedin_message";
}

export function useOutreachQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const wa = useWhatsAppExtensionBridge();
  const li = useLinkedInExtensionBridge();
  const trackActivity = useTrackActivity();

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const updateStatus = async (id: string, status: string, error?: string) => {
    const updates: Record<string, unknown> = { status, processed_at: new Date().toISOString() };
    if (error) updates.last_error = error;
    await updateOutreachItem(id, updates);
  };

  const incrementAttempts = async (id: string) => {
    const data = await getOutreachItemField(id, "attempts");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
      await updateOutreachItem(id, { attempts: ((data as any).attempts || 0) + 1 });
    }
  };

  const trackQueueItem = useCallback((item: QueueItem, channel: string) => {
    trackActivity.mutate({
      activityType: channelToActivityType(channel),
      title: `${item.recipient_name || item.recipient_email || item.recipient_phone || "contatto"} — Queue auto`,
      sourceId: item.created_by || crypto.randomUUID(),
      sourceType: "imported_contact",
      emailSubject: item.subject || undefined,
      description: `Messaggio ${channel} inviato dalla coda automatica`,
    });
  }, [trackActivity]);

  const processItem = useCallback(async (item: QueueItem): Promise<boolean> => {
    await updateStatus(item.id, "processing");
    await incrementAttempts(item.id);

    try {
      switch (item.channel) {
        case "whatsapp": {
          if (!wa.isAvailable) { await updateStatus(item.id, "failed", "Estensione WhatsApp non disponibile"); return false; }
          if (!wa.isAuthenticated) { await updateStatus(item.id, "pending", "WhatsApp Web non autenticato"); return false; }
          const phone = item.recipient_phone?.replace(/[^0-9+]/g, "").replace(/^\+/, "") || "";
          if (!phone) { await updateStatus(item.id, "failed", "Numero telefono mancante"); return false; }
          const res = await wa.sendWhatsApp(phone, item.body);
          if (res.success) { await updateStatus(item.id, "sent"); trackQueueItem(item, "whatsapp"); toast({ title: "✅ WhatsApp inviato", description: `A: ${item.recipient_name || phone}` }); return true; }
          await updateStatus(item.id, item.attempts + 1 >= item.max_attempts ? "failed" : "pending", res.error);
          return false;
        }
        case "linkedin": {
          if (!li.isAvailable) { await updateStatus(item.id, "failed", "Estensione LinkedIn non disponibile"); return false; }
          const profileUrl = item.recipient_linkedin_url || "";
          if (!profileUrl) { await updateStatus(item.id, "failed", "URL profilo LinkedIn mancante"); return false; }
          let liRes = await li.sendDirectMessage(profileUrl, item.body);
          if (!liRes.success && liRes.error?.includes("context invalidated")) {
            await new Promise(r => setTimeout(r, 2000));
            liRes = await li.sendDirectMessage(profileUrl, item.body);
          }
          if (liRes.success) { await updateStatus(item.id, "sent"); trackQueueItem(item, "linkedin"); toast({ title: "✅ LinkedIn inviato", description: `A: ${item.recipient_name || "contatto"}` }); return true; }
          await updateStatus(item.id, item.attempts + 1 >= item.max_attempts ? "failed" : "pending", liRes.error);
          return false;
        }
        case "email": {
          try {
            await invokeEdge("send-email", { body: { to: item.recipient_email, subject: item.subject || "(nessun oggetto)", html: item.body }, context: "useOutreachQueue.email" });
          } catch (err) {
            const msg = isApiError(err) ? err.message : (err instanceof Error ? err.message : String(err));
            log.error("queue email send failed", { error: msg, to: item.recipient_email });
            await updateStatus(item.id, item.attempts + 1 >= item.max_attempts ? "failed" : "pending", msg);
            return false;
          }
          await updateStatus(item.id, "sent"); trackQueueItem(item, "email"); toast({ title: "✅ Email inviata", description: `A: ${item.recipient_email}` }); return true;
        }
        default: await updateStatus(item.id, "failed", `Canale non supportato: ${item.channel}`); return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
      log.error("queue processItem failed", { error: msg, channel: item.channel, id: item.id });
      await updateStatus(item.id, item.attempts + 1 >= item.max_attempts ? "failed" : "pending", msg);
      return false;
    }
  }, [wa, li, trackQueueItem]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || pausedRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const items = await findPendingOutreachItems(5);
      if (!items || items.length === 0) { setPendingCount(0); return; }
      setPendingCount(items.length);
      for (const item of items as QueueItem[]) {
        if (pausedRef.current) break;
        await processItem(item);
        const delay = CHANNEL_DELAYS[item.channel] || 3000;
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (err: unknown) {
      log.error("processQueue failed", { error: err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err) });
    } finally { processingRef.current = false; setProcessing(false); }
  }, [processItem]);

  useEffect(() => {
    const interval = setInterval(() => { if (!pausedRef.current) processQueue(); }, 5000);
    processQueue();
    return () => clearInterval(interval);
  }, [processQueue]);

  useEffect(() => {
    const channel = supabase
      .channel("outreach-queue-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "outreach_queue" }, () => {
        if (!pausedRef.current) setTimeout(() => processQueue(), 1000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [processQueue]);

  return { pendingCount, processing, paused, setPaused };
}
