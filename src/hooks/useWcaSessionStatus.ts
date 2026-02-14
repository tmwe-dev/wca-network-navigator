import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WcaSessionStatus = "ok" | "expired" | "no_cookie" | "checking" | "error";

export interface WcaDiagnostics {
  hasAspxAuth?: boolean;
  membersOnlyCount?: number;
  contactsTotal?: number;
  contactsWithRealName?: number;
  contactsWithEmail?: number;
}

export function useWcaSessionStatus() {
  const statusQuery = useQuery({
    queryKey: ["wca-session-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["wca_session_status", "wca_session_checked_at"]);

      const map: Record<string, string> = {};
      data?.forEach((r: any) => { map[r.key] = r.value; });

      return {
        status: (map.wca_session_status || "no_cookie") as WcaSessionStatus,
        checkedAt: map.wca_session_checked_at || null,
      };
    },
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes — avoid excessive WCA requests
  });

  // Store latest diagnostics from check
  let lastDiagnostics: WcaDiagnostics | null = null;
  const [isChecking, setIsChecking] = useState(false);

  const triggerCheck = async (): Promise<{ status: WcaSessionStatus; authenticated: boolean; diagnostics?: WcaDiagnostics } | null> => {
    setIsChecking(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-wca-session`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await res.json();
      lastDiagnostics = data.diagnostics || null;
      statusQuery.refetch();
      return {
        status: (data.status || "error") as WcaSessionStatus,
        authenticated: !!data.authenticated,
        diagnostics: data.diagnostics,
      };
    } catch (err) {
      console.error("WCA session check failed:", err);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    status: statusQuery.data?.status ?? "checking",
    checkedAt: statusQuery.data?.checkedAt ?? null,
    diagnostics: lastDiagnostics,
    isLoading: statusQuery.isLoading,
    isChecking,
    triggerCheck,
  };
}
