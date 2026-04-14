/**
 * useLinkedInSoftSync — Stealth soft sync with daily slots and manual override.
 * Replaces useLinkedInSync. Uses shared softTimer + workHours primitives.
 *
 * LinkedIn: defaults pensati per 4-6 letture/giorno.
 * Detection LinkedIn è più aggressiva di WhatsApp,
 * non abbassare interval sotto 3600s senza verifica.
 */
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "@/hooks/useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { nextDelayMs, type SoftTimerConfig, type DelayPattern } from "@/lib/time/softTimer";
import { isOutsideWorkHours, msUntilNextWorkStart } from "@/lib/time/workHours";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { insertChannelMessage } from "@/data/channelMessages";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useLinkedInSoftSync");

// ── Default config ──
const DEFAULTS: Record<string, string> = {
  li_scan_enabled: "true",
  li_scan_interval_sec: "14400",
  li_scan_top_threads: "10",
  li_scan_max_deep_reads: "2",
  li_scan_stagger_sec: "60",
  li_scan_jitter_pct: "30",
  li_scan_long_pause_pct: "15",
  li_scan_quick_check_pct: "3",
  li_scan_work_start_hour: "8",
  li_scan_work_end_hour: "20",
};

function getSetting(settings: Record<string, string> | undefined, key: string): string {
  return settings?.[key] ?? DEFAULTS[key] ?? "";
}

function getNum(settings: Record<string, string> | undefined, key: string): number {
  return parseInt(getSetting(settings, key), 10) || 0;
}

function buildCycleConfig(settings: Record<string, string> | undefined): SoftTimerConfig {
  return {
    baseIntervalSec: getNum(settings, "li_scan_interval_sec"),
    jitterPct: getNum(settings, "li_scan_jitter_pct"),
    longPauseChancePct: getNum(settings, "li_scan_long_pause_pct"),
    longPauseMinMult: 1.5,
    longPauseMaxMult: 3.0,
    quickCheckChancePct: getNum(settings, "li_scan_quick_check_pct"),
    quickCheckMinMult: 0.5,
    quickCheckMaxMult: 0.8,
    antiRepeatToleranceMs: 5000,
  };
}

function buildStaggerConfig(settings: Record<string, string> | undefined): SoftTimerConfig {
  return {
    baseIntervalSec: getNum(settings, "li_scan_stagger_sec"),
    jitterPct: getNum(settings, "li_scan_jitter_pct"),
    longPauseChancePct: 0,
    longPauseMinMult: 1,
    longPauseMaxMult: 1,
    quickCheckChancePct: 0,
    quickCheckMinMult: 1,
    quickCheckMaxMult: 1,
    antiRepeatToleranceMs: 2000,
  };
}

export interface LinkedInCycleStats {
  scannedThreads: number;
  threadsWithChanges: number;
  deepReads: number;
  newMessages: number;
  durationMs: number;
  errors: number;
  pattern: DelayPattern;
  triggered_by: "auto" | "manual";
}

export function useLinkedInSoftSync() {
  const [enabled, setEnabled] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPausedForNight, setIsPausedForNight] = useState(false);
  const [lastCycleAt, setLastCycleAt] = useState<Date | null>(null);
  const [nextCycleAt, setNextCycleAt] = useState<Date | null>(null);
  const [lastCycleStats, setLastCycleStats] = useState<LinkedInCycleStats | null>(null);

  const { isAvailable, readInbox, readThread } = useLinkedInMessagingBridge();
  const { data: settings } = useAppSettings();
  const queryClient = useQueryClient();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const readingRef = useRef(false);
  const previousCycleMsRef = useRef<number | undefined>();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const config = useMemo(() => buildCycleConfig(settings), [settings]);

  const executeCycle = useCallback(async (overrides?: {
    staggerSec?: number;
    maxDeepReads?: number;
  }): Promise<Omit<LinkedInCycleStats, "triggered_by">> => {
    const start = Date.now();
    const s = settingsRef.current;
    const topThreads = getNum(s, "li_scan_top_threads");
    const maxDeep = overrides?.maxDeepReads ?? getNum(s, "li_scan_max_deep_reads");
    const staggerCfg = overrides?.staggerSec
      ? { ...buildStaggerConfig(s), baseIntervalSec: overrides.staggerSec }
      : buildStaggerConfig(s);

    const stats: Omit<LinkedInCycleStats, "triggered_by"> = {
      scannedThreads: 0, threadsWithChanges: 0, deepReads: 0,
      newMessages: 0, durationMs: 0, errors: 0, pattern: "normal",
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return stats;
      const userId = session.user.id;

      const result = await readInbox();
      if (!result.success) {
        log.warn("readInbox.failed", { error: result.error });
        stats.errors++;
        return stats;
      }

      const threads = (result.threads || []).slice(0, topThreads);
      stats.scannedThreads = threads.length;

      const deepQueue: Array<{ name: string; threadUrl: string }> = [];

      for (const thread of threads) {
        if (!thread.name || !thread.lastMessage) continue;

        // Check if we have this message already
        const { data: lastDbMsg } = await supabase
          .from("channel_messages")
          .select("body_text, created_at")
          .eq("channel", "linkedin")
          .eq("user_id", userId)
          .or(`from_address.ilike.%${thread.name}%,thread_id.eq.${thread.threadUrl || ""}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const dbText = lastDbMsg?.body_text || "";
        if (dbText !== thread.lastMessage || thread.unread) {
          deepQueue.push({ name: thread.name, threadUrl: thread.threadUrl });
          stats.threadsWithChanges++;
        }
      }

      // Process deep queue
      let prevStaggerMs: number | undefined;
      for (let i = 0; i < Math.min(deepQueue.length, maxDeep); i++) {
        if (!mountedRef.current) break;

        if (i > 0) {
          const stagger = nextDelayMs(staggerCfg, prevStaggerMs);
          prevStaggerMs = stagger.delayMs;
          await new Promise(r => setTimeout(r, stagger.delayMs));
        }

        const item = deepQueue[i];
        try {
          const threadResult = await readThread(item.threadUrl || item.name);
          stats.deepReads++;

          if (threadResult.success && threadResult.messages) {
            for (const msg of threadResult.messages) {
              if (!msg.text?.trim()) continue;
              const extId = buildDeterministicId(
                "li", item.name, msg.text, msg.timestamp || new Date().toISOString()
              );
              const error = await insertChannelMessage({
                user_id: userId,
                channel: "linkedin",
                direction: msg.direction === "outbound" ? "outbound" : "inbound",
                from_address: msg.direction === "outbound" ? undefined : (msg.sender || item.name),
                to_address: msg.direction === "outbound" ? item.name : undefined,
                body_text: msg.text,
                message_id_external: extId,
                thread_id: item.threadUrl || null,
              }).then(() => null).catch(e => e);

              if (!error) stats.newMessages++;
              else if (error.code !== "23505") {
                log.warn("insert_error", { message: error.message });
                stats.errors++;
              }
            }
          }
        } catch (err) {
          stats.errors++;
          log.warn("deep_read.failed", { thread: item.name, error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Also save sidebar-level messages for threads we didn't deep-read
      for (const thread of threads) {
        if (!thread.name || !thread.lastMessage) continue;
        const extId = buildDeterministicId("li", thread.name, thread.lastMessage, new Date().toISOString());
        await insertChannelMessage({
          user_id: userId,
          channel: "linkedin",
          direction: "inbound",
          from_address: thread.name,
          body_text: thread.lastMessage,
          message_id_external: extId,
          thread_id: thread.threadUrl || null,
        }).catch(() => { /* dedup */ });
      }

      if (stats.newMessages > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unread });
        toast.success(`💼 ${stats.newMessages} nuovi messaggi LinkedIn`, { duration: 2000 });
        window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "linkedin" } }));
      }
    } catch (err) {
      stats.errors++;
      log.warn("cycle.failed", { error: err instanceof Error ? err.message : String(err) });
    }

    stats.durationMs = Date.now() - start;
    return stats;
  }, [readInbox, readThread, queryClient]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!mountedRef.current) return;

    const s = settingsRef.current;
    const workStart = getNum(s, "li_scan_work_start_hour");
    const workEnd = getNum(s, "li_scan_work_end_hour");

    if (isOutsideWorkHours(workStart, workEnd)) {
      setIsPausedForNight(true);
      const resumeMs = msUntilNextWorkStart(workStart) + Math.random() * 30 * 60_000;
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
        const rawStats = await executeCycle();
        const stats: LinkedInCycleStats = { ...rawStats, pattern: delay.pattern, triggered_by: "auto" };
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

  // Start/stop loop based on enabled + settings
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    const scanEnabled = getSetting(settings, "li_scan_enabled") === "true";
    if (!enabled || !scanEnabled || !isAvailable) {
      setNextCycleAt(null);
      setIsPausedForNight(false);
      return;
    }

    scheduleNext();

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, isAvailable, settings, scheduleNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Manual cycle — bypasses night pause, uses faster overrides
  const manualCycle = useCallback(async () => {
    if (readingRef.current) return;
    readingRef.current = true;
    setIsReading(true);
    toast.info("Lettura manuale LinkedIn in corso...");
    try {
      const rawStats = await executeCycle({ staggerSec: 30, maxDeepReads: 5 });
      const stats: LinkedInCycleStats = { ...rawStats, triggered_by: "manual" };
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

  return {
    enabled,
    toggle,
    isReading,
    isAvailable,
    lastCycleAt,
    nextCycleAt,
    lastCycleStats,
    manualCycle,
    isPausedForNight,
    config,
  };
}
