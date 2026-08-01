/**
 * useLinkedInAutoSync — Auto-sync LinkedIn LENTO (2-3 letture al giorno).
 *
 * LinkedIn ha detection anti-bot più aggressiva di WhatsApp: niente cadenza
 * a minuti come WA. Si pianificano N letture al giorno (default 3) in slot
 * pseudo-random distribuiti uniformemente nella finestra operativa
 * (default 9-19 CET), con jitter ±20 min. Persistenza in localStorage.
 *
 * Tutti i parametri sono letti da `app_settings`:
 *  - linkedin_auto_sync_enabled  (true/false)
 *  - linkedin_read_times_per_day (1..6, default 3)
 *  - linkedin_read_start_hour    (0..23, default 9)
 *  - linkedin_read_end_hour      (0..24, default 19)
 *
 * Guard: paused (notte), isAvailable, tab visibile, single-flight, non
 * eseguire se l'ultima sync (manuale o auto) è < 30 min fa.
 *
 * Trigger manuale dal bottone header (`li-sync-trigger`) consumato qui:
 * forza una lettura ma NON azzera la sequenza degli slot.
 */
import { useEffect, useRef } from "react";
import { useLinkedInSync } from "@/hooks/useLinkedInSync";
import { useAppSettings } from "@/hooks/useAppSettings";

const STATE_KEY = "li_auto_sync_state_v1";
const MIN_GAP_BETWEEN_SYNCS_MS = 30 * 60_000;

interface PersistedState {
  // ms epoch dello slot programmato corrente
  nextRunAt: number | null;
  // ms epoch dell'ultima sync eseguita (manuale o auto)
  lastRunAt: number | null;
  // YYYY-MM-DD del giorno cui appartengono gli slot di nextRunAt
  slotsForDay: string | null;
  // slot rimanenti programmati per oggi (ordinati ascending)
  remainingSlotsMs: number[];
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch { /* ignore */ }
  return { nextRunAt: null, lastRunAt: null, slotsForDay: null, remainingSlotsMs: [] };
}

function saveState(s: PersistedState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Genera N slot pseudo-random distribuiti nella finestra [startHour..endHour] CET.
 * Divide la finestra in N segmenti uguali e mette uno slot in ciascuno con
 * jitter ±20 min, evitando di concentrare le letture vicine.
 */
function generateSlots(times: number, startHour: number, endHour: number): number[] {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(startHour, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(endHour, 0, 0, 0);

  const segmentMs = (endToday.getTime() - startToday.getTime()) / Math.max(1, times);
  const jitterMs = 20 * 60_000;
  const slots: number[] = [];
  for (let i = 0; i < times; i++) {
    const segMid = startToday.getTime() + segmentMs * (i + 0.5);
    const jitter = (Math.random() * 2 - 1) * jitterMs;
    slots.push(Math.round(segMid + jitter));
  }
  return slots.sort((a, b) => a - b);
}

interface Opts { paused: boolean }

export function useLinkedInAutoSync({ paused }: Opts) {
  const { isAvailable, isReading, readNow } = useLinkedInSync();
  const { data: settings } = useAppSettings();

  const enabled =
    !paused &&
    isAvailable &&
    (settings?.linkedin_auto_sync_enabled ?? "true") !== "false";

  const timesPerDay = Math.max(1, Math.min(6,
    parseInt(settings?.linkedin_read_times_per_day || "3", 10) || 3,
  ));
  const startHour = parseInt(settings?.linkedin_read_start_hour || "9", 10);
  const endHour = parseInt(settings?.linkedin_read_end_hour || "19", 10);

  const stateRef = useRef<PersistedState>(loadState());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }

    function ensureSlotsForToday() {
      const s = stateRef.current;
      const today = todayKey();
      if (s.slotsForDay !== today || s.remainingSlotsMs.length === 0) {
        const fresh = generateSlots(timesPerDay, startHour, endHour);
        // Tieni solo gli slot futuri
        const future = fresh.filter((t) => t > Date.now());
        s.slotsForDay = today;
        s.remainingSlotsMs = future;
        s.nextRunAt = future[0] ?? null;
        saveState(s);
      }
    }

    function scheduleNext() {
      clearTimer();
      if (!enabledRef.current) return;
      ensureSlotsForToday();
      const s = stateRef.current;
      let next = s.nextRunAt;
      if (!next) {
        // Nessuno slot oggi → riprova domani mattina
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(startHour, 0, 0, 0);
        next = tomorrow.getTime();
      }
      const wait = Math.max(60_000, next - Date.now());
      timerRef.current = setTimeout(() => { void runTick(); }, wait);
    }

    async function runTick() {
      if (!enabledRef.current) { scheduleNext(); return; }
      if (readingRef.current) { scheduleNext(); return; }
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        // Riproveremo al prossimo visibilitychange
        return;
      }
      const s = stateRef.current;
      const lastGap = s.lastRunAt ? Date.now() - s.lastRunAt : Number.POSITIVE_INFINITY;
      if (lastGap < MIN_GAP_BETWEEN_SYNCS_MS) {
        // Sync recente (manuale o auto): salta questo slot
        s.remainingSlotsMs = s.remainingSlotsMs.filter((t) => t > Date.now());
        s.nextRunAt = s.remainingSlotsMs[0] ?? null;
        saveState(s);
        scheduleNext();
        return;
      }
      try {
        await readNow(true); // silent: niente toast per le letture automatiche
      } finally {
        s.lastRunAt = Date.now();
        s.remainingSlotsMs = s.remainingSlotsMs.filter((t) => t > Date.now());
        s.nextRunAt = s.remainingSlotsMs[0] ?? null;
        saveState(s);
        scheduleNext();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && enabledRef.current && !timerRef.current) {
        scheduleNext();
      }
    }

    function onTrigger() {
      if (readingRef.current) return;
      void (async () => {
        try { await readNow(); } finally {
          stateRef.current.lastRunAt = Date.now();
          saveState(stateRef.current);
          scheduleNext();
        }
      })();
    }

    if (enabled) {
      scheduleNext();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("li-sync-trigger", onTrigger);
    }

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("li-sync-trigger", onTrigger);
    };
  }, [enabled, readNow, timesPerDay, startHour, endHour]);

  return { enabled, isReading };
}
