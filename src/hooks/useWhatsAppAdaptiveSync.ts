/**
 * useWhatsAppAdaptiveSync — WhatsApp polling with fixed irregular intervals.
 *
 * Polling sequence (minutes): 5, 8, 4, 12, 17, 3, 4, 34 — then loops.
 * Paused during night hours (agent_work_start_hour / agent_work_end_hour from app_settings).
 * Only runs when the toggle is enabled AND the extension bridge is available + authenticated.
 */
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppDomLearning } from "@/hooks/useWhatsAppDomLearning";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { markSessionExpired } from "@/lib/inbox/sessionTracker";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useWhatsAppAdaptiveSync");

// ── Fixed irregular polling intervals (minutes) ──
const POLLING_INTERVALS_MIN = [5, 8, 4, 12, 17, 3, 4, 34] as const;

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /auth|session|login|expired|unauthorized|qr|logout/i.test(msg);
}

// ── Night hours check using CET/CEST (Europe/Rome) ──
function getCETHour(): number {
  const now = new Date();
  const cetString = now.toLocaleString("en-US", { timeZone: "Europe/Rome", hour12: false, hour: "2-digit" });
  return parseInt(cetString, 10);
}

function isOutsideWorkHours(startHour: number, endHour: number): boolean {
  const hour = getCETHour();
  if (endHour > startHour) {
    // e.g. 6–24: outside if hour < 6 or hour >= 24
    return hour < startHour || hour >= endHour;
  }
  // Wraps midnight (e.g. 22–6): outside if hour >= endHour AND hour < startHour
  return hour >= endHour && hour < startHour;
}

// ── Attention level kept for UI compatibility but no longer drives intervals ──
export type AttentionLevel = 0 | 3 | 6;

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
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
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

  // Work hours from app_settings (cached)
  const workHoursRef = useRef({ start: 6, end: 24 });
  const workHoursLoadedRef = useRef(false);

  const focusedChatRef = useRef<string | null>(null);
  const readingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAuthRef = useRef(false);
  const onReconnectRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollIndexRef = useRef(0);

  // Mount guard
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep refs in sync
  useEffect(() => { focusedChatRef.current = focusedChat; }, [focusedChat]);
  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  // Load work hours from DB once
  useEffect(() => {
    if (workHoursLoadedRef.current) return;
    workHoursLoadedRef.current = true;
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["agent_work_start_hour", "agent_work_end_hour"])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          if (row.key === "agent_work_start_hour") workHoursRef.current.start = parseInt(row.value || "6", 10);
          if (row.key === "agent_work_end_hour") workHoursRef.current.end = parseInt(row.value || "24", 10);
        }
        log.info("work_hours_loaded", { start: workHoursRef.current.start, end: workHoursRef.current.end });
      });
  }, []);

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
      if (!error && status === 201) newCount++;
    }
    return { newCount };
  }, []);

  // ── Sidebar scan ──
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
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
        setLevel(3);
        if (!focusedChatRef.current) {
          const firstUnread = messages.find(m => !m.isVerify && (m.unreadCount || 0) > 0);
          if (firstUnread) {
            setFocusedChat(firstUnread.contact || firstUnread.from || "unknown");
          }
        }
        toast.success(`📱 ${newCount} nuovi messaggi WhatsApp`, { duration: 2000 });
        window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "whatsapp" } }));
      } else {
        setLevel(0);
      }
    } catch (err: unknown) {
      log.warn("sidebar_scan.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setIsReading(false);
    }
  }, [readUnread, saveMessages, queryClient]);

  // ── Thread scan (when focused on a chat) ──
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
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
      }
    } catch (err: unknown) {
      log.warn("thread_scan.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setIsReading(false);
    }
  }, [readThread, saveMessages, queryClient]);

  // ── Main tick ──
  const tick = useCallback(async () => {
    // Check work hours
    if (isOutsideWorkHours(workHoursRef.current.start, workHoursRef.current.end)) {
      log.info("tick.skipped", { reason: "outside work hours", hour: getCETHour() });
      return;
    }
    if (!isAuthenticated) {
      log.warn("tick.skipped", { reason: "WhatsApp Web not authenticated" });
      return;
    }
    if (focusedChatRef.current) {
      await threadScan();
    } else {
      await sidebarScan();
    }
  }, [sidebarScan, threadScan, isAuthenticated]);

  // ── Fixed irregular polling timer ──
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!enabled || !isAvailable) {
      log.info("polling.stopped", { enabled, isAvailable });
      return;
    }

    log.info("polling.started", { sequence: POLLING_INTERVALS_MIN.join(",") });

    const scheduleNext = () => {
      const idx = pollIndexRef.current % POLLING_INTERVALS_MIN.length;
      const intervalMs = POLLING_INTERVALS_MIN[idx] * 60_000;
      pollIndexRef.current = idx + 1;

      log.debug("polling.scheduled", { nextInMin: POLLING_INTERVALS_MIN[idx], index: idx });

      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        await tick();
        if (mountedRef.current) scheduleNext();
      }, intervalMs);
    };

    // First tick immediately, then start the sequence
    tick().then(() => {
      if (mountedRef.current) scheduleNext();
    });

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, isAvailable, tick]);

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
    setLevel(3);
  }, []);

  // ── Manual read now ──
  const readNow = useCallback(async () => {
    if (!isAvailable) {
      toast.error("Estensione WhatsApp non rilevata. Verifica che sia installata e la pagina ricaricata.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("WhatsApp Web non autenticato. Apri web.whatsapp.com e scansiona il QR code.");
      return;
    }
    await sidebarScan();
  }, [sidebarScan, isAvailable, isAuthenticated]);

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
