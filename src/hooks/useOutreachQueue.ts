/**
 * useOutreachQueue — coda automatica di invio outreach.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import { toast } from "@/hooks/use-toast";
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

export function useOutreachQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const updateStatus = async (id: string, status: string, error?: string) => {
    const updates: Record<string, unknown> = { status, processed_at: new Date().toISOString() };
    if (error) updates.last_error = error;
    await updateOutreachItem(id, updates);
  };

  const incrementAttempts = async (id: string) => {
    const data = await getOutreachItemField(id, "attempts");
    if (data) {
      await updateOutreachItem(id, { attempts: ((data as unknown as Record<string, unknown>).attempts as number || 0) + 1 });
    }
  };

  const processItem = useCallback(async (item: QueueItem): Promise<boolean> => {
    await updateStatus(item.id, "processing");
    await incrementAttempts(item.id);

    try {
      // SSOT v3.9.56: ogni invio (WA/LI/Email) DEVE passare da
      // ai_pending_actions → useApproveAndDispatch (editorial review hard).
      // La coda outreach NON invia più direttamente: trasferisce l'item
      // alla coda di approvazione umana.
      const supportedChannels = ["whatsapp", "linkedin", "email"];
      if (!supportedChannels.includes(item.channel)) {
        await updateStatus(item.id, "failed", `Canale non supportato: ${item.channel}`);
        return false;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? item.created_by;
      if (!userId) {
        await updateStatus(item.id, "failed", "Sessione utente assente");
        return false;
      }
      const actionType =
        item.channel === "whatsapp" ? "send_whatsapp" :
        item.channel === "linkedin" ? "send_linkedin" :
        "send_email";
      const payload: Record<string, unknown> = {
        recipient: item.recipient_email || item.recipient_phone || item.recipient_linkedin_url,
        message_text: item.body,
        subject: item.subject || undefined,
        contact_name: item.recipient_name,
        outreach_queue_id: item.id,
      };
      const { error } = await supabase.from("ai_pending_actions").insert({
        user_id: userId,
        action_type: actionType,
        action_payload: payload as never,
        suggested_content: item.body,
        email_address: item.recipient_email ?? null,
        reasoning: `Trasferito da outreach_queue (${item.channel}). In attesa di approvazione umana.`,
        confidence: 0.85,
        source: "outreach_queue",
        status: "pending",
      });
      if (error) {
        log.error("queue transfer failed", { error: error.message, channel: item.channel, id: item.id });
        await updateStatus(item.id, item.attempts + 1 >= item.max_attempts ? "failed" : "pending", error.message);
        return false;
      }
      await updateStatus(item.id, "transferred");
      toast({ title: "📥 Messaggio in coda di approvazione", description: `${item.channel.toUpperCase()} → ${item.recipient_name || item.recipient_email || item.recipient_phone}` });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("queue processItem failed", { error: msg, channel: item.channel, id: item.id });
      await updateStatus(item.id, item.attempts + 1 >= item.max_attempts ? "failed" : "pending", msg);
      return false;
    }
  }, []);

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
      log.error("processQueue failed", { error: err instanceof Error ? err.message : String(err) });
    } finally { processingRef.current = false; setProcessing(false); }
  }, [processItem]);

  // Hold latest processQueue in a ref so polling/realtime effects can stay
  // mounted with empty deps even when processQueue's identity changes due to
  // unstable bridge returns (wa/li). Without this, the interval was being
  // re-created on every render, piling up dozens of concurrent fetches.
  const processQueueRef = useRef(processQueue);
  useEffect(() => { processQueueRef.current = processQueue; }, [processQueue]);

  useEffect(() => {
    const tick = () => { if (!pausedRef.current) processQueueRef.current(); };
    const interval = setInterval(tick, 5000);
    tick();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("outreach-queue-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "outreach_queue" }, () => {
        if (!pausedRef.current) setTimeout(() => processQueueRef.current(), 1000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { pendingCount, processing, paused, setPaused };
}
