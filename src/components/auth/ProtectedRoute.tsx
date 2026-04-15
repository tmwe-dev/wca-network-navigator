/**
 * ProtectedRoute — dead simple.
 * 1. getSession() once on mount
 * 2. If session exists → whitelist check → "authed" or signOut
 * 3. onAuthStateChange for SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT
 * No AuthProvider dependency. No prefetch. No side effects.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcIsEmailAuthorized } from "@/data/rpc";
import { Loader2 } from "lucide-react";

type AuthGate = "loading" | "authed" | "guest";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [gate, setGate] = useState<AuthGate>("loading");
  const checkingRef = useRef(false);

  const verifyAndSet = useCallback(async (email: string | undefined) => {
    if (!email) {
      await supabase.auth.signOut();
      setGate("guest");
      return;
    }
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const allowed = await rpcIsEmailAuthorized(email);
      if (allowed) {
        setGate("authed");
      } else {
        await supabase.auth.signOut();
        setGate("guest");
      }
    } catch {
      // Fail-open: if RPC is down, allow (the login page already checked)
      setGate("authed");
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Bootstrap: check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user?.email) {
        verifyAndSet(session.user.email);
      } else {
        setGate("guest");
      }
    }).catch(() => {
      if (mounted) setGate("guest");
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setGate("guest");
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        verifyAndSet(session?.user?.email);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [verifyAndSet]);

  if (gate === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (gate === "guest") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
