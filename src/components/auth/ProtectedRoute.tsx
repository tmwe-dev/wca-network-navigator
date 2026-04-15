/**
 * ProtectedRoute — minimal auth gate.
 * getSession → whitelist check → authed or guest.
 * onAuthStateChange for SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcIsEmailAuthorized } from "@/data/rpc";
import { Loader2 } from "lucide-react";

type State = "loading" | "authed" | "guest";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const [state, setState] = useState<State>("loading");
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) { setState("guest"); return; }
      const allowed = await rpcIsEmailAuthorized(session.user.email);
      if (!allowed) { await supabase.auth.signOut(); setState("guest"); return; }
      setState("authed");
    } catch {
      setState("guest");
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") setState("guest");
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") check();
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [check]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "guest") return <Navigate to="/auth" replace />;

  return children ? <>{children}</> : <Outlet />;
}
