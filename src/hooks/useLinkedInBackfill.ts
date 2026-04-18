/**
 * LinkedIn Backfill — Unified: "Scarica Quello Che Manca"
 * Same logic as WhatsApp backfill:
 * Phase 1: Discovery → read inbox, detect gaps vs DB
 * Phase 2: Deep recovery → readThread + backfillThread (scroll-back) per thread
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";

type BackfillStatus = "idle" | "running" | "paused" | "done" | "error";
type BackfillPhase = "idle" | "discovery" | "deep";

type BackfillProgress = {
  status: BackfillStatus;
  phase: BackfillPhase;
  currentThread: string | null;
  threadsProcessed: number;
  threadsTotal: number;
  recoveredMessages: number;
  pauseReason: string | null;
  lastError: string | null;
};

const INITIAL: BackfillProgress = {
  status: "idle", phase: "idle", currentThread: null,
  threadsProcessed: 0, threadsTotal: 0, recoveredMessages: 0,
  pauseReason: null, lastError: null,
};

const MAX_THREADS_PER_SESSION = 5;
const PAUSE_BETWEEN_THREADS_MS = 18_000;
const MAX_SCROLLS_PER_THREAD = 20;

function jitteredPause(base: number): number {
  return base * (0.85 + Math.random() * 0.30);
}

function sleepAbortable(ms: number, abortRef: React.MutableRefObject<boolean>): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (abortRef.current || Date.now() - start >= ms) {
        clearInterval(interval);
        resolve(abortRef.current);
      }
    }, 250);
  });
}

export function useLinkedInBackfill() {
  const [progress, setProgress] = useState<BackfillProgress>(INITIAL);
  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const { readInbox, readThread, backfillThread } = useLinkedInMessagingBridge();

  const startBackfill = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    abortRef.current = false;
    setProgress({ ...INITIAL, status: "running", phase: "discovery" });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); return; }

      // ── PHASE 1: Discovery ──
      const inboxResult = await readInbox();
      if (!inboxResult.success || !inboxResult.threads?.length) {
        setProgress(p => ({ ...p, status: "done", phase: "idle" }));
        toast.info("Nessun thread LinkedIn trovato");
        return;
      }

      if (abortRef.current) { setProgress(p => ({ ...p, status: "paused", phase: "idle" })); return; }

      // Detect gaps: compare last sidebar message vs last DB message per thread
      const threadsWithGap: { name: string; threadUrl: string; lastDbText: string | null }[] = [];

      for (const thread of inboxResult.threads) {
        if (threadsWithGap.length >= MAX_THREADS_PER_SESSION) break;
        if (!thread.name || !thread.threadUrl) continue;

        const { data: lastMsg } = await supabase
          .from("channel_messages")
          .select("body_text, created_at")
          .eq("user_id", user.id)
          .eq("channel", "linkedin")
          .or(`from_address.ilike.%${thread.name}%,to_address.ilike.%${thread.name}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const sidebarText = (thread.lastMessage || "").trim().toLowerCase();
        const dbText = (lastMsg?.body_text || "").trim().toLowerCase();

        if (!lastMsg || (sidebarText && sidebarText !== dbText)) {
          threadsWithGap.push({ name: thread.name, threadUrl: thread.threadUrl, lastDbText: lastMsg?.body_text || null });
        }
      }

      if (threadsWithGap.length === 0) {
        setProgress(p => ({ ...p, status: "done", phase: "idle" }));
        toast.success("Tutte le conversazioni LinkedIn sono aggiornate ✅");
        return;
      }

      // ── PHASE 2: Deep Recovery ──
      setProgress(p => ({ ...p, phase: "deep", threadsTotal: threadsWithGap.length, threadsProcessed: 0 }));
      let totalRecovered = 0;

      for (let i = 0; i < threadsWithGap.length; i++) {
        if (abortRef.current) {
          setProgress(p => ({ ...p, status: "paused", phase: "idle" }));
          toast.info("Recupero interrotto");
          return;
        }

        const thread = threadsWithGap[i];
        setProgress(p => ({ ...p, currentThread: thread.name, threadsProcessed: i }));

        let messages: Array<Record<string, unknown>> = [];

        // Step 1: Read visible messages
        const threadResult = await readThread(thread.threadUrl);
        if (threadResult.success && threadResult.messages?.length) {
          messages = threadResult.messages as Record<string, unknown>[];
        }

        // Step 2: Check if anchor is among visible messages
        if (thread.lastDbText && messages.length > 0) {
          const foundAnchor = messages.some((m) => {
            const t = String(m.text || "").trim().toLowerCase();
            return t === thread.lastDbText!.trim().toLowerCase();
          });

          // If anchor NOT found → scroll-back with backfillThread
          if (!foundAnchor) {
            const backfillResult = await backfillThread(thread.threadUrl, thread.lastDbText, MAX_SCROLLS_PER_THREAD);
            if (backfillResult.success && backfillResult.messages?.length) {
              messages = [...messages, ...(backfillResult.messages as Record<string, unknown>[])];
            }
          }
        } else if (!thread.lastDbText) {
          // No messages in DB at all → do full backfill
          const backfillResult = await backfillThread(thread.threadUrl, "", MAX_SCROLLS_PER_THREAD);
          if (backfillResult.success && backfillResult.messages?.length) {
            messages = [...messages, ...(backfillResult.messages as Record<string, unknown>[])];
          }
        }

        // Step 3: Save all messages to DB via upsert (ignores duplicates)
        let chatRecovered = 0;
        for (const msg of messages) {
          const text = String(msg.text || "").trim();
          if (!text) continue;
          const sender = String(msg.sender || msg.contact || thread.name).trim();
          const timestamp = String(msg.timestamp || new Date().toISOString());
          const direction = String(msg.direction || "inbound");
          const extId = buildDeterministicId("li", thread.name, text, timestamp);

          const { error, status } = await supabase
            .from("channel_messages")
            .upsert({
              user_id: user.id,
              channel: "linkedin" as never,
              direction: (direction === "outbound" ? "outbound" : "inbound") as never,
              from_address: direction === "outbound" ? undefined : thread.name,
              to_address: direction === "outbound" ? thread.name : undefined,
              body_text: text,
              message_id_external: extId,
            } as never, { onConflict: "message_id_external", ignoreDuplicates: true });

          if (!error && status === 201) chatRecovered++;
          // log used to silence unused var warning
          void sender;
        }

        totalRecovered += chatRecovered;
        setProgress(p => ({ ...p, recoveredMessages: totalRecovered, threadsProcessed: i + 1 }));

        // Pause between threads (human-like)
        if (i < threadsWithGap.length - 1) {
          const aborted = await sleepAbortable(jitteredPause(PAUSE_BETWEEN_THREADS_MS), abortRef);
          if (aborted) {
            setProgress(p => ({ ...p, status: "paused", phase: "idle" }));
            toast.info("Recupero interrotto");
            return;
          }
        }
      }

      setProgress(p => ({ ...p, status: "done", phase: "idle", currentThread: null }));
      toast.success(`LinkedIn: ${totalRecovered} messaggi recuperati da ${threadsWithGap.length} conversazioni`);
    } catch (err: unknown) {
      setProgress(p => ({ ...p, status: "error", lastError: err instanceof Error ? err.message : String(err) }));
      toast.error(`Errore: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      runningRef.current = false;
    }
  }, [readInbox, readThread, backfillThread]);

  const stopBackfill = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { progress, startBackfill, stopBackfill };
}
