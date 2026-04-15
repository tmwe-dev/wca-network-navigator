import { useEffect, useRef, useState, useCallback } from "react";
import { useCheckInbox } from "@/hooks/useChannelMessages";
import { createLogger } from "@/lib/log";
import { useAuth } from "@/providers/AuthProvider";

const log = createLogger("useEmailAutoSync");

const STORAGE_KEY = "email_auto_sync_enabled";
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface Options {
  /** External pause signal (e.g. night pause) */
  paused?: boolean;
}

export function useEmailAutoSync(options: Options = {}) {
  const { paused = false } = options;
  const { status } = useAuth();

  // Default to TRUE (auto-enabled)
  const [enabled, setEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // If never set, default to true
      return stored === null ? true : stored === "true";
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); return true; }
  });
  const checkInbox = useCheckInbox();
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); }
      return next;
    });
  }, []);

  const active = enabled && !paused && status === "authenticated";

  useEffect(() => {
    if (!active) {
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
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    enabled,
    toggle,
    isChecking: checkInbox.isPending,
    checkNow: () => checkInbox.mutate(),
  };
}
