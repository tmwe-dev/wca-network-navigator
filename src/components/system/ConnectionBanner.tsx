import { useState, useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { createLogger } from "@/lib/log";
import { checkProfileConnection } from "@/data/profiles";

const log = createLogger("ConnectionBanner");

/**
 * Shows a red banner when DB connection is lost.
 * Auth removed — no redirect, always polls.
 */
export function ConnectionBanner() {
  const [dbLost, setDbLost] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const heartbeat = async () => {
      try {
        const { error } = await checkProfileConnection();
        if (error) {
          setDbLost(true);
        } else {
          setDbLost(false);
        }
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
        setDbLost(true);
      }
    };

    intervalRef.current = setInterval(heartbeat, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!dbLost) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      Connessione al database persa — riprovo automaticamente…
    </div>
  );
}
