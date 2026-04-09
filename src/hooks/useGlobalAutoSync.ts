import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";

/**
 * Returns true if local time is between 00:00 and 06:00.
 */
function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 6;
}

/**
 * Centralised auto-sync orchestrator.
 * - Auto-activates email sync and WhatsApp adaptive sync on mount
 * - Pauses everything during night hours (00:00–06:00 local time)
 * - Calls useAutoConnect for LinkedIn/WhatsApp session verification
 */
export function useGlobalAutoSync() {
  useAutoConnect();

  const [nightPause, setNightPause] = useState(isNightTime);
  const nightCheckRef = useRef<ReturnType<typeof setInterval>>();

  // Check night status every 5 minutes
  useEffect(() => {
    nightCheckRef.current = setInterval(() => {
      setNightPause(isNightTime());
    }, 5 * 60 * 1000);
    return () => { if (nightCheckRef.current) clearInterval(nightCheckRef.current); };
  }, []);

  // Email auto-sync — always enabled, paused at night
  const emailSync = useEmailAutoSync({ paused: nightPause });

  // WhatsApp adaptive sync — always enabled, paused at night
  const waSync = useWhatsAppAdaptiveSync();

  // Auto-enable WhatsApp sync on mount (once)
  const waInitDone = useRef(false);
  useEffect(() => {
    if (waInitDone.current) return;
    waInitDone.current = true;
    if (!waSync.enabled) {
      waSync.setEnabled(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause/resume WA sync based on night status
  useEffect(() => {
    if (nightPause && waSync.enabled) {
      waSync.setEnabled(false);
    } else if (!nightPause && !waSync.enabled && waInitDone.current) {
      waSync.setEnabled(true);
    }
  }, [nightPause]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    nightPause,
    emailSync,
    waSync,
  };
}
