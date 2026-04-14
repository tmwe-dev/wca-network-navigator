import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppDomLearning } from "@/hooks/useWhatsAppDomLearning";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { markSessionExpired } from "@/lib/inbox/sessionTracker";

const log = createLogger("useWhatsAppAdaptiveSync");

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /auth|session|login|expired|unauthorized|qr|logout/i.test(msg);
}

// ── Attention Levels ──
export type AttentionLevel = 0 | 3 | 6;

const INTERVALS: Record<AttentionLevel, number> = {
  0: 75_000,
  3: 15_000,
  6: 4_000,
};

function jitter(base: number) {
  return base * (0.8 + Math.random() * 0.4);
}

const DEESCALATE_6_TO_3 = 60_000;
const DEESCALATE_3_TO_0 = 180_000;

const OUTBOUND_PREFIXES = ["tu: ", "you: ", "tú: ", "du: ", "vous: ", "вы: ", "あなた: "];

function detectDirection(text: string): { direction: "inbound" | "outbound"; cleanText: string } {
  const lower = text.toLowerCase();
  for (const prefix of OUTBOUND_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { direction: "outbound", cleanText: text.slice(prefix.length) };
    }
  }
  return { direction: "inbound", cleanText: text };
}

function normalizeWhatsAppTimestamp(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const date = new Date();
    date.setHours(Number(hhmmMatch[1]), Number(hhmmMatch[2]), 0, 0);
    return date.toISOString();
  }

  return null;
}

interface WhatsAppSidebarMessage {
  contact?: string;
  from?: string;
  time?: string;
  timestamp?: string;
  lastMessage?: string;
  text?: string;
  unreadCount?: number;
  isVerify?: boolean;
  direction?: "inbound" | "outbound";
}

function isSidebarPreviewMessage(msg: WhatsAppSidebarMessage) {
  return Object.prototype.hasOwnProperty.call(msg, "lastMessage") ||
    Object.prototype.hasOwnProperty.call(msg, "unreadCount");
}

function shouldSkipSidebarMessage(msg: WhatsAppSidebarMessage, text: string, rawTime: string) {
  if (msg.isVerify === true) return true;
  if (!isSidebarPreviewMessage(msg)) return false;
  if (!text.trim()) return true;
  return rawTime.trim().length === 0;
}

export function useWhatsAppAdaptiveSync() {
  const [level, setLevel] = useState<AttentionLevel>(0);
  const [isReading, setIsReading] = useState(false);
  const [focusedChat, setFocusedChat] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const { isAvailable, isAuthenticated, readUnread, readThread, onSidebarChanged } = useWhatsAppExtensionBridge();
  const { getSchema: _getSchema, forceRelearn, isStale: domIsStale, lastLearnedAt } = useWhatsAppDomLearning();
  const queryClient = useQueryClient();

  const levelRef = useRef<AttentionLevel>(0);
  const focusedChatRef = useRef<string | null>(null);
  const readingRef = useRef(false);
  const lastNewMsgAt = useRef(0);
  const lastReplyAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deescalateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAuthRef = useRef(false);
  const onReconnectRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Mount guard
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep refs in sync
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { focusedChatRef.current = focusedChat; }, [focusedChat]);
  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  // ── Escalate ──
  const escalate = useCallback((to: AttentionLevel) => {
    setLevel(prev => {
      if (to > prev) return to;
      return prev;
    });
  }, []);

  // ── De-escalate ──
  const deescalate = useCallback((to: AttentionLevel) => {
    setLevel(prev => {
      if (to < prev) return to;
      return prev;
    });
    if (to === 0) setFocusedChat(null);
  }, []);

  // ── Schedule de-escalation ──
  const scheduleDeescalation = useCallback(() => {
    if (deescalateTimerRef.current) clearTimeout(deescalateTimerRef.current);
    
    const currentLevel = levelRef.current;
    if (currentLevel === 0) return;

    const timeout = currentLevel === 6 ? DEESCALATE_6_TO_3 : DEESCALATE_3_TO_0;
    const targetLevel: AttentionLevel = currentLevel === 6 ? 3 : 0;

    deescalateTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      deescalate(targetLevel);
      if (targetLevel === 3) scheduleDeescalation();
    }, timeout);
  }, [deescalate]);

  // ── Save messages to DB ──
  const saveMessages = useCallback(async (messages: WhatsAppSidebarMessage[], sessionUserId: string) => {
    let newCount = 0;

    for (const msg of messages) {
      const contact = String(msg.contact || msg.from || "").trim();
      if (!contact) continue;

      const rawTime = String(msg.time || msg.timestamp || "");
      const rawText = String(msg.lastMessage || msg.text || "");
      if (shouldSkipSidebarMessage(msg, rawText, rawTime)) continue;

      const { direction: detectedDir, cleanText } = detectDirection(rawText);
      const finalDirection = msg.direction || detectedDir;
      const text = cleanText.trim();
      if (!text) continue;

      const timestamp = normalizeWhatsAppTimestamp(rawTime) || new Date().toISOString();
      const extId = buildDeterministicId("wa", contact, text, rawTime || timestamp);

      const row = {
        user_id: sessionUserId,
        channel: "whatsapp",
        direction: finalDirection,
        from_address: finalDirection === "outbound" ? undefined : contact,
        to_address: finalDirection === "outbound" ? contact : undefined,
        body_text: text,
        message_id_external: extId,
        raw_payload: JSON.parse(JSON.stringify(msg)) as Record<string, string>,
        created_at: timestamp,
      };
      const { error, status } = await supabase
        .from("channel_messages")
        .upsert([row], { onConflict: "user_id,message_id_external", ignoreDuplicates: true });

      if (!error && status === 201) {
        newCount++;
      }
    }
    return { newCount };
  }, []);

  // ── Sidebar scan (Level 0 & 3) ──
  const sidebarScan = useCallback(async () => {
    if (readingRef.current) return;
    if (!mountedRef.current) return;
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const result = await readUnread();
      if (!result.success) return;

      const messages = ((result as Record<string, unknown>).messages || []) as WhatsAppSidebarMessage[];
      if (!messages.length) return;

      const { newCount } = await saveMessages(messages, session.user.id);

      if (newCount > 0) {
        lastNewMsgAt.current = Date.now();
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });

        if (levelRef.current === 0) {
          escalate(3);
          scheduleDeescalation();
        }

        if (focusedChatRef.current) {
          const hasReplyInFocused = messages.some(
            (m) => (m.contact || m.from || "").toLowerCase() === focusedChatRef.current!.toLowerCase() && !m.isVerify
          );
          if (hasReplyInFocused) {
            lastReplyAt.current = Date.now();
            escalate(6);
            scheduleDeescalation();
          }
        }

        if (!focusedChatRef.current && levelRef.current >= 3) {
          const firstUnread = messages.find((m) => !m.isVerify && (m.unreadCount || 0) > 0);
          if (firstUnread) {
            const contact = firstUnread.contact || firstUnread.from || "unknown";
            setFocusedChat(contact);
          }
        }

        if (newCount > 0) {
          toast.success(`📱 ${newCount} nuovi messaggi WhatsApp`, { duration: 2000 });
        }
        window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "whatsapp" } }));
      }
    } catch (err: unknown) {
      log.warn("sidebar_scan.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setIsReading(false);
    }
  }, [readUnread, saveMessages, queryClient, escalate, scheduleDeescalation]);

  // ── Thread scan (Level 6) ──
  const threadScan = useCallback(async () => {
    if (readingRef.current || !focusedChatRef.current) return;
    if (!mountedRef.current) return;
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const result = await readThread(focusedChatRef.current, 20);
      if (!result.success) return;

      const messages = ((result as Record<string, unknown>).messages || []) as WhatsAppSidebarMessage[];
      if (!messages.length) return;

      const { newCount } = await saveMessages(messages, session.user.id);

      if (newCount > 0) {
        lastReplyAt.current = Date.now();
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
        scheduleDeescalation();
      }
    } catch (err: unknown) {
      log.warn("thread_scan.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setIsReading(false);
    }
  }, [readThread, saveMessages, queryClient, scheduleDeescalation]);

  // ── Main tick ──
  const tick = useCallback(async () => {
    if (!isAuthenticated) {
      log.warn("tick.skipped", { reason: "WhatsApp Web not authenticated" });
      return;
    }
    if (levelRef.current === 6 && focusedChatRef.current) {
      await threadScan();
    } else {
      await sidebarScan();
    }
  }, [sidebarScan, threadScan, isAuthenticated]);

  // ── Adaptive timer ──
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!enabled || !isAvailable) return;

    const schedule = () => {
      const interval = jitter(INTERVALS[level]);
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        await tick();
        if (mountedRef.current) schedule();
      }, interval);
    };

    tick().then(() => { if (mountedRef.current) schedule(); });

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, isAvailable, level, tick]);

  // ── MutationObserver push: instant scan on sidebar change ──
  useEffect(() => {
    if (!enabled || !isAvailable) return;
    onSidebarChanged(() => {
      if (!readingRef.current && mountedRef.current) {
        sidebarScan();
      }
    });
    return () => onSidebarChanged(() => {});
  }, [enabled, isAvailable, onSidebarChanged, sidebarScan]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (deescalateTimerRef.current) { clearTimeout(deescalateTimerRef.current); deescalateTimerRef.current = null; }
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    };
  }, []);

  // ── Auto-trigger backfill on reconnection (false → true) ──
  useEffect(() => {
    if (prevAuthRef.current === false && isAuthenticated === true) {
      log.info("reconnection_detected", { triggering: "deep_backfill" });
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) onReconnectRef.current?.();
      }, 5000);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // ── Manual focus on a chat ──
  const focusOn = useCallback((contact: string) => {
    setFocusedChat(contact);
    escalate(3);
    scheduleDeescalation();
  }, [escalate, scheduleDeescalation]);

  // ── Manual read now ──
  const readNow = useCallback(async () => {
    await sidebarScan();
  }, [sidebarScan]);

  const toggle = useCallback(() => setEnabled(prev => !prev), []);

  const levelLabel = useMemo(() => {
    switch (level) {
      case 0: return "Idle";
      case 3: return "Alert";
      case 6: return "Live";
    }
  }, [level]);

  const onReconnect = useCallback((cb: () => void) => {
    onReconnectRef.current = cb;
  }, []);

  return {
    level,
    levelLabel,
    enabled,
    toggle,
    setEnabled,
    isReading,
    isAvailable,
    isAuthenticated,
    focusedChat,
    focusOn,
    readNow,
    onReconnect,
    domIsStale,
    lastLearnedAt,
    forceRelearn,
  };
}
