import { useEffect, useRef, useCallback, useState } from "react";
import { useWhatsAppInbox } from "@/hooks/useWhatsAppInbox";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";

const DEFAULT_INTERVAL_MS = 60_000; // 1 minuto

export function useWhatsAppAutoSync(intervalMs = DEFAULT_INTERVAL_MS) {
  const [autoEnabled, setAutoEnabled] = useState(false);
  const { readInbox, isReading } = useWhatsAppInbox();
  const { isAvailable } = useWhatsAppExtensionBridge();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingRef = useRef(false);

  // Keep ref in sync to avoid stale closures
  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  const tick = useCallback(async () => {
    if (readingRef.current) return; // skip if already reading
    try { await readInbox(); } catch (_) { /* toast already shown */ }
  }, [readInbox]);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    if (autoEnabled && isAvailable) {
      // First tick immediately
      tick();
      timerRef.current = setInterval(tick, intervalMs);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoEnabled, isAvailable, intervalMs, tick]);

  const toggle = useCallback(() => setAutoEnabled(prev => !prev), []);

  return { autoEnabled, toggle, setAutoEnabled, isReading, isAvailable, readInbox };
}
