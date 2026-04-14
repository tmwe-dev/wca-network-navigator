import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { useWhatsAppSoftSync } from "@/hooks/useWhatsAppSoftSync";

export function useGlobalAutoSync() {
  useAutoConnect();

  // Email auto-sync
  const emailSync = useEmailAutoSync();

  // WhatsApp soft sync — night pauses are handled internally by the hook
  const waSync = useWhatsAppSoftSync();

  const waInitDone = useRef(false);
  useEffect(() => {
    if (waInitDone.current) return;
    waInitDone.current = true;
    if (!waSync.enabled) waSync.setEnabled(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    nightPause: waSync.isPausedForNight,
    emailSync,
    waSync,
  };
}
