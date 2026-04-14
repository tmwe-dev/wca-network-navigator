import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { useWhatsAppSoftSync } from "@/hooks/useWhatsAppSoftSync";
import { isOutsideWorkHours, msUntilNextWorkStart } from "@/lib/time/workHours";

export function useGlobalAutoSync() {
  useAutoConnect();

  // Email auto-sync
  const emailSync = useEmailAutoSync();

  // WhatsApp soft sync — night pauses handled internally
  const waSync = useWhatsAppSoftSync();

  const waInitDone = useRef(false);
  useEffect(() => {
    if (waInitDone.current) return;
    waInitDone.current = true;
    if (!waSync.enabled) waSync.setEnabled(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy compat: expose night pause info for ConnectionStatusBar
  const nightPause = waSync.isPausedForNight;

  return {
    nightPause,
    isNightTime: nightPause,
    manualOverride: false,
    toggleNightPause: () => { /* no-op: night pauses are automatic in soft sync */ },
    resumeMinutes: 0,
    emailSync,
    waSync,
  };
}
