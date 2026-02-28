import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RouteState = "loading" | "auth" | "onboarding" | "ready" | "error";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const [state, setState] = useState<RouteState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const check = async () => {
    setState("loading");
    setErrorMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState("auth"); return; }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("[ProtectedRoute] Profile fetch error:", error);
        setErrorMsg(error.message || "Errore caricamento profilo");
        setState("error");
        return;
      }

      if (!profile || !profile.onboarding_completed) {
        setState("onboarding");
      } else {
        setState("ready");
      }
    } catch (e: any) {
      console.error("[ProtectedRoute] Unexpected error:", e);
      setErrorMsg(e?.message || "Errore di rete");
      setState("error");
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setState("auth");
      else if (event === "SIGNED_IN") check();
    });

    check();
    return () => subscription.unsubscribe();
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <div className="text-destructive text-lg font-semibold">⚠️ Errore</div>
        <p className="text-sm text-muted-foreground max-w-md">{errorMsg || "Errore imprevisto"}</p>
        <Button variant="outline" size="sm" onClick={check}>
          <RefreshCw className="w-4 h-4 mr-2" /> Riprova
        </Button>
      </div>
    );
  }

  if (state === "auth") return <Navigate to="/auth" replace />;
  if (state === "onboarding") return <Navigate to="/onboarding" replace />;

  return children ? <>{children}</> : <Outlet />;
}
