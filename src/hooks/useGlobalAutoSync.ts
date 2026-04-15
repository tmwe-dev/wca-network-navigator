import { useEffect, useRef } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { useWhatsAppSoftSync } from "@/hooks/useWhatsAppSoftSync";

interface UseGlobalAutoSyncOptions {
  enabled?: boolean;
}

export function useGlobalAutoSync(options: UseGlobalAutoSyncOptions = {}) {
  const { enabled = true } = options;

  useAutoConnect({ enabled });

  // Email auto-sync
  const emailSync = useEmailAutoSync({ paused: !enabled });

  // WhatsApp soft sync — night pauses handled internally
  const waSync = useWhatsAppSoftSync();

  const waInitDone = useRef(false);
  useEffect(() => {
    if (!enabled) {
      waInitDone.current = false;
      if (waSync.enabled) waSync.setEnabled(false);
      return;
    }

    if (waInitDone.current) return;
    waInitDone.current = true;
    if (!waSync.enabled) waSync.setEnabled(true);
  }, [enabled, waSync.enabled, waSync.setEnabled]);

  // Legacy compat: expose night pause info for ConnectionStatusBar
  const nightPause = enabled ? waSync.isPausedForNight : false;

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
