import { useEffect, useRef, useState, useCallback } from "react";
import { useCheckInbox } from "@/hooks/useChannelMessages";

const STORAGE_KEY = "email_auto_sync_enabled";
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useEmailAutoSync() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const checkInbox = useCheckInbox();
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Immediate first check
    checkInbox.mutate();

    timerRef.current = setInterval(() => {
      if (!checkInbox.isPending) {
        checkInbox.mutate();
      }
    }, INTERVAL_MS);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    enabled,
    toggle,
    isChecking: checkInbox.isPending,
    checkNow: () => checkInbox.mutate(),
  };
}
