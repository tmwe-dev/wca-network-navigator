import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "auth" | "onboarding" | "ready">("loading");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState("auth"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!profile || !profile.onboarding_completed) {
        setState("onboarding");
      } else {
        setState("ready");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setState("auth");
      else if (event === "SIGNED_IN") check();
    });

    check();
    return () => subscription.unsubscribe();
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (state === "auth") return <Navigate to="/auth" replace />;
  if (state === "onboarding") return <Navigate to="/onboarding" replace />;

  return children ? <>{children}</> : <Outlet />;
}
