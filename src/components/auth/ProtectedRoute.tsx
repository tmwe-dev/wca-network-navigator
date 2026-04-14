import { useEffect, useState, useRef } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { rpcIsEmailAuthorized } from "@/data/rpc";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("ProtectedRoute");

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { status, session, event } = useAuth();
  const location = useLocation();
  const [whitelistOk, setWhitelistOk] = useState<boolean | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) {
      setWhitelistOk(null);
      return;
    }

    // Run check on mount and on relevant auth events
    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "INITIAL_SESSION" ||
      // Also run when whitelistOk hasn't been set yet (first mount)
      whitelistOk === null
    ) {
      if (checkingRef.current) return;
      checkingRef.current = true;

      rpcIsEmailAuthorized(session.user.email)
        .then(async (allowed) => {
          if (!allowed) {
            log.warn("whitelist revoked for user", { email: session.user.email });
            toast.error("Accesso revocato. Contatta l'amministratore.");
            await supabase.auth.signOut();
            // status will flip to "unauthenticated" via AuthProvider
          } else {
            setWhitelistOk(true);
          }
        })
        .catch((err) => {
          log.warn("whitelist check failed, allowing access", {
            error: err instanceof Error ? err.message : String(err),
          });
          // On RPC failure, allow access (fail-open to avoid locking out
          // everyone if the RPC is temporarily down). The Auth.tsx login
          // guard already did the initial check.
          setWhitelistOk(true);
        })
        .finally(() => {
          checkingRef.current = false;
        });
    }
  }, [status, session, event, whitelistOk]);

  // Still loading auth state or whitelist check
  if (status === "loading" || (status === "authenticated" && whitelistOk === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
