/**
 * useWhatsAppAutoSync — Auto-sync WhatsApp con cadenza irregolare a ciclo.
 *
 * Sequenza intervalli (minuti): 20, 18, 8, 3, 15, 7, 18, 15, 2, 3, 20
 * A fine ciclo, pausa di ciclo (minuti): 2, 5, 3, 2 (rotazione)
 *
 * Guard:
 *  - servizio WA connesso (estensione + autenticato)
 *  - non in pausa notturna
 *  - tab visibile
 *  - single-flight: se sync in corso, riprogramma soltanto
 *
 * Si attiva automaticamente quando WA è connesso, si ferma quando si scollega.
 * Trigger immediato via window event "wa-sync-trigger" (no reset sequenza).
 */
import { useEffect, useRef } from "react";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";

const SYNC_INTERVALS_MIN = [20, 18, 8, 3, 15, 7, 18, 15, 2, 3, 20];
const CYCLE_PAUSES_MIN = [2, 5, 3, 2];
const STATE_KEY = "wa_sync_sequence_state";

interface SeqState {
  intervalIndex: number;
  cyclePauseIndex: number;
}

function loadState(): SeqState {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SeqState;
      if (typeof parsed.intervalIndex === "number" && typeof parsed.cyclePauseIndex === "number") {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { intervalIndex: 0, cyclePauseIndex: 0 };
}

function saveState(s: SeqState) {
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function useWhatsAppAutoSync(opts: { paused: boolean }) {
  const { paused } = opts;
  const { isAvailable, isAuthenticated, isReading, readNow } = useWhatsAppAdaptiveSync();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<SeqState>(loadState());
  const readingRef = useRef(false);
  const enabledRef = useRef(false);

  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  const enabled = isAvailable && isAuthenticated && !paused;
  enabledRef.current = enabled;

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleNext() {
      clearTimer();
      if (!enabledRef.current) return;

      const s = stateRef.current;
      let waitMin: number;
      if (s.intervalIndex >= SYNC_INTERVALS_MIN.length) {
        // Pausa di ciclo
        waitMin = CYCLE_PAUSES_MIN[s.cyclePauseIndex % CYCLE_PAUSES_MIN.length];
        s.cyclePauseIndex = (s.cyclePauseIndex + 1) % CYCLE_PAUSES_MIN.length;
        s.intervalIndex = 0;
      } else {
        waitMin = SYNC_INTERVALS_MIN[s.intervalIndex];
        s.intervalIndex += 1;
      }
      saveState(s);

      timerRef.current = setTimeout(() => {
        runTick();
      }, waitMin * 60_000);
    }

    async function runTick() {
      if (!enabledRef.current) return;
      if (readingRef.current) {
        // single-flight: riprogramma soltanto
        scheduleNext();
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        // posticipa al prossimo visibilitychange
        return;
      }
      try {
        await readNow();
      } finally {
        scheduleNext();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && enabledRef.current && !timerRef.current) {
        scheduleNext();
      }
    }

    function onTrigger() {
      // Trigger manuale (bottone): esegue subito, non resetta sequenza,
      // ma riprogramma il prossimo tick partendo dal valore corrente.
      if (readingRef.current) return;
      void (async () => {
        try { await readNow(); } finally { scheduleNext(); }
      })();
    }

    if (enabled) {
      scheduleNext();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("wa-sync-trigger", onTrigger);
    }

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("wa-sync-trigger", onTrigger);
    };
  }, [enabled, readNow]);

  return { enabled, isReading };
}