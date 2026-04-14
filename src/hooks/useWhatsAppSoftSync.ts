/**
 * useWhatsAppSoftSync — Stealth sync with multimodal timing and night pauses.
 * Replaces useWhatsAppAdaptiveSync.
 */
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { nextDelayMs, type SoftTimerConfig, type DelayPattern } from "@/lib/time/softTimer";
import { isOutsideWorkHours, msUntilNextWorkStart } from "@/lib/time/workHours";
import { normalizePhone } from "@/lib/phone/normalize";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { markSessionExpired } from "@/lib/inbox/sessionTracker";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useWhatsAppSoftSync");

// ── Default config ──
const DEFAULTS = {
  wa_scan_enabled: "true",
  wa_scan_interval_sec: "120",
  wa_scan_top_chats: "8",
  wa_scan_max_deep_reads: "3",
  wa_scan_stagger_sec: "15",
  wa_scan_jitter_pct: "25",
  wa_scan_long_pause_pct: "10",
  wa_scan_quick_check_pct: "5",
  wa_scan_work_start_hour: "7",
  wa_scan_work_end_hour: "22",
} as const;

function getSetting(settings: Record<string, string> | undefined, key: string): string {
  return settings?.[key] ?? DEFAULTS[key as keyof typeof DEFAULTS] ?? "";
}

function getNum(settings: Record<string, string> | undefined, key: string): number {
  return parseInt(getSetting(settings, key), 10) || 0;
}

function buildCycleConfig(settings: Record<string, string> | undefined): SoftTimerConfig {
  return {
    baseIntervalSec: getNum(settings, "wa_scan_interval_sec"),
    jitterPct: getNum(settings, "wa_scan_jitter_pct"),
    longPauseChancePct: getNum(settings, "wa_scan_long_pause_pct"),
    longPauseMinMult: 1.8,
    longPauseMaxMult: 3.5,
    quickCheckChancePct: getNum(settings, "wa_scan_quick_check_pct"),
    quickCheckMinMult: 0.5,
    quickCheckMaxMult: 0.8,
    antiRepeatToleranceMs: 1500,
  };
}

function buildStaggerConfig(settings: Record<string, string> | undefined): SoftTimerConfig {
  return {
    baseIntervalSec: getNum(settings, "wa_scan_stagger_sec"),
    jitterPct: getNum(settings, "wa_scan_jitter_pct"),
    longPauseChancePct: 0,
    longPauseMinMult: 1,
    longPauseMaxMult: 1,
    quickCheckChancePct: 0,
    quickCheckMinMult: 1,
    quickCheckMaxMult: 1,
    antiRepeatToleranceMs: 500,
  };
}

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /auth|session|login|expired|unauthorized|qr|logout/i.test(msg);
}

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

export interface CycleStats {
  scannedChats: number;
  chatsWithChanges: number;
  deepReads: number;
  newMessages: number;
  durationMs: number;
  errors: number;
  pattern: DelayPattern;
}

export function useWhatsAppSoftSync() {
  const [enabled, setEnabled] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPausedForNight, setIsPausedForNight] = useState(false);
  const [lastCycleAt, setLastCycleAt] = useState<Date | null>(null);
  const [nextCycleAt, setNextCycleAt] = useState<Date | null>(null);
  const [lastCycleStats, setLastCycleStats] = useState<CycleStats | null>(null);

  const { isAvailable, isAuthenticated, readUnread, readThread } = useWhatsAppExtensionBridge();
  const { data: settings } = useAppSettings();
  const queryClient = useQueryClient();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const readingRef = useRef(false);
  const previousCycleMsRef = useRef<number | undefined>();
  const prevAuthRef = useRef(false);
  const onReconnectRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const config = useMemo(() => buildCycleConfig(settings), [settings]);

  const saveMessages = useCallback(async (messages: WhatsAppSidebarMessage[], userId: string) => {
    let newCount = 0;
    for (const msg of messages) {
      const contact = String(msg.contact || msg.from || "").trim();
      if (!contact) continue;
      const rawTime = String(msg.time || msg.timestamp || "");
      const rawText = String(msg.lastMessage || msg.text || "");
      if (msg.isVerify) continue;
      const { direction: detectedDir, cleanText } = detectDirection(rawText);
      const finalDirection = msg.direction || detectedDir;
      const text = cleanText.trim();
      if (!text) continue;
      const timestamp = normalizeWhatsAppTimestamp(rawTime) || new Date().toISOString();
      const extId = buildDeterministicId("wa", contact, text, rawTime || timestamp);
      const row = {
        user_id: userId,
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
    return newCount;
  }, []);

  const executeCycle = useCallback(async (): Promise<CycleStats> => {
    const start = Date.now();
    const s = settingsRef.current;
    const topChats = getNum(s, "wa_scan_top_chats");
    const maxDeep = getNum(s, "wa_scan_max_deep_reads");
    const staggerCfg = buildStaggerConfig(s);

    const stats: CycleStats = {
      scannedChats: 0, chatsWithChanges: 0, deepReads: 0,
      newMessages: 0, durationMs: 0, errors: 0, pattern: "normal",
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return stats;
      const userId = session.user.id;

      const result = await readUnread();
      if (!result.success) { stats.errors++; return stats; }

      const messages = ((result as Record<string, unknown>).messages || []) as WhatsAppSidebarMessage[];
      const chats = messages.slice(0, topChats);
      stats.scannedChats = chats.length;

      const deepQueue: string[] = [];
      for (const chat of chats) {
        const contact = String(chat.contact || chat.from || "").trim();
        if (!contact) continue;
        const normalized = normalizePhone(contact) || contact;
        const rawText = String(chat.lastMessage || chat.text || "").trim();
        if (!rawText) continue;

        const { data: lastDbMsg } = await supabase
          .from("channel_messages")
          .select("body_text, created_at")
          .eq("channel", "whatsapp")
          .or(`from_address.eq.${normalized},to_address.eq.${normalized},from_address.eq.${contact},to_address.eq.${contact}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const dbText = lastDbMsg?.body_text || "";
        const hasUnread = (chat.unreadCount || 0) > 0;
        if (dbText !== rawText || hasUnread) {
          deepQueue.push(contact);
          stats.chatsWithChanges++;
        }
      }

      for (let i = 0; i < Math.min(deepQueue.length, maxDeep); i++) {
        if (!mountedRef.current) break;

        if (i > 0) {
          const stagger = nextDelayMs(staggerCfg, previousCycleMsRef.current);
          await new Promise(r => setTimeout(r, stagger.delayMs));
        }

        const contact = deepQueue[i];
        try {
          const threadResult = await readThread(contact, 20);
          stats.deepReads++;
          if (threadResult.success) {
            const threadMsgs = ((threadResult as Record<string, unknown>).messages || []) as WhatsAppSidebarMessage[];
            const newCount = await saveMessages(threadMsgs, userId);
            stats.newMessages += newCount;
          }
        } catch (err) {
          stats.errors++;
          log.warn("deep_read.failed", { contact, error: err instanceof Error ? err.message : String(err) });
          if (isAuthError(err)) {
            await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
          }
        }
      }

      const sidebarNew = await saveMessages(chats, userId);
      stats.newMessages += sidebarNew;

      if (stats.newMessages > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unread });
        toast.success(`📱 ${stats.newMessages} nuovi messaggi WhatsApp`, { duration: 2000 });
        window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "whatsapp" } }));
      }
    } catch (err) {
      stats.errors++;
      log.warn("cycle.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    }

    stats.durationMs = Date.now() - start;
    return stats;
  }, [readUnread, readThread, saveMessages, queryClient]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!mountedRef.current) return;

    const s = settingsRef.current;
    const workStart = getNum(s, "wa_scan_work_start_hour");
    const workEnd = getNum(s, "wa_scan_work_end_hour");

    if (isOutsideWorkHours(workStart, workEnd)) {
      setIsPausedForNight(true);
      const resumeMs = msUntilNextWorkStart(workStart) + Math.random() * 15 * 60_000;
      setNextCycleAt(new Date(Date.now() + resumeMs));
      log.info("night_pause", { resumeInMin: Math.round(resumeMs / 60_000) });
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) scheduleNext();
      }, resumeMs);
      return;
    }

    setIsPausedForNight(false);

    const cycleCfg = buildCycleConfig(settingsRef.current);
    const delay = nextDelayMs(cycleCfg, previousCycleMsRef.current);
    previousCycleMsRef.current = delay.delayMs;
    setNextCycleAt(new Date(Date.now() + delay.delayMs));

    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      readingRef.current = true;
      setIsReading(true);
      try {
        const stats = await executeCycle();
        stats.pattern = delay.pattern;
        if (mountedRef.current) {
          setLastCycleAt(new Date());
          setLastCycleStats(stats);
        }
      } finally {
        if (mountedRef.current) {
          readingRef.current = false;
          setIsReading(false);
          scheduleNext();
        }
      }
    }, delay.delayMs);
  }, [executeCycle]);

  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    const scanEnabled = getSetting(settings, "wa_scan_enabled") === "true";
    if (!enabled || !scanEnabled || !isAvailable || !isAuthenticated) {
      setNextCycleAt(null);
      setIsPausedForNight(false);
      return;
    }

    scheduleNext();

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, isAvailable, isAuthenticated, settings, scheduleNext]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (prevAuthRef.current === false && isAuthenticated === true) {
      log.info("reconnection_detected", { triggering: "deep_backfill" });
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) onReconnectRef.current?.();
      }, 5000);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const manualCycle = useCallback(async () => {
    if (readingRef.current) return;
    readingRef.current = true;
    setIsReading(true);
    try {
      const stats = await executeCycle();
      if (mountedRef.current) {
        setLastCycleAt(new Date());
        setLastCycleStats(stats);
      }
    } finally {
      if (mountedRef.current) {
        readingRef.current = false;
        setIsReading(false);
      }
    }
  }, [executeCycle]);

  const toggle = useCallback(() => setEnabled(prev => !prev), []);

  const onReconnect = useCallback((cb: () => void) => {
    onReconnectRef.current = cb;
  }, []);

  return {
    enabled,
    toggle,
    setEnabled,
    isReading,
    isAvailable,
    isAuthenticated,
    lastCycleAt,
    nextCycleAt,
    lastCycleStats,
    manualCycle,
    isPausedForNight,
    config,
    onReconnect,
  };
}
