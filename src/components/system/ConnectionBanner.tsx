import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { createLogger } from "@/lib/log";
import { checkProfileConnection } from "@/data/profiles";
import { supabase } from "@/integrations/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";

const log = createLogger("ConnectionBanner");

/**
 * Shows a red banner when DB connection is lost.
 * Redirects to /auth if auth expires mid-session.
 * Only polls when a session is active.
 */
export function ConnectionBanner() {
  const [dbLost, setDbLost] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let mounted = true;

    // Bootstrap
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setHasSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (!mounted) return;
      if (event === "TOKEN_REFRESHED") setDbLost(false);
      if (event === "SIGNED_OUT") {
        setDbLost(false);
        setHasSession(false);
        navigate("/auth", { replace: true });
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setHasSession(true);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  // Heartbeat only when session is active
  useEffect(() => {
    if (!hasSession) {
      clearInterval(intervalRef.current);
      return;
    }

    const heartbeat = async () => {
      try {
        const { error } = await checkProfileConnection();
        if (error) {
          if (error.code === "PGRST301" || error.message?.includes("JWT")) {
            setDbLost(false);
            navigate("/auth", { replace: true });
            return;
          }
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
  }, [hasSession, navigate]);

  if (!dbLost) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      Connessione al database persa — riprovo automaticamente…
    </div>
  );
}
