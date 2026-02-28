import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { WifiOff } from "lucide-react";

/**
 * Shows a red banner when DB connection is lost.
 * Redirects to /auth if auth expires mid-session.
 */
export function ConnectionBanner() {
  const [dbLost, setDbLost] = useState(false);
  const navigate = useNavigate();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Lightweight heartbeat every 30s
    const heartbeat = async () => {
      try {
        const { error } = await supabase.from("profiles").select("id").limit(1);
        if (error) {
          // RLS error means connection works, auth might be expired
          if (error.code === "PGRST301" || error.message?.includes("JWT")) {
            setDbLost(false);
            navigate("/auth", { replace: true });
            return;
          }
          setDbLost(true);
        } else {
          setDbLost(false);
        }
      } catch {
        setDbLost(true);
      }
    };

    intervalRef.current = setInterval(heartbeat, 30000);
    return () => clearInterval(intervalRef.current);
  }, [navigate]);

  // Also listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") setDbLost(false);
      if (event === "SIGNED_OUT") {
        setDbLost(false);
        navigate("/auth", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!dbLost) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      Connessione al database persa — riprovo automaticamente…
    </div>
  );
}
