import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WcaSessionStatus = "ok" | "expired" | "no_cookie" | "checking" | "error";

export function useWcaSessionStatus() {
  // Poll app_settings for the cached status
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
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Trigger a fresh check via the edge function and return the result directly
  const triggerCheck = async (): Promise<{ status: WcaSessionStatus; authenticated: boolean } | null> => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-wca-session`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      // Refetch in background to update React Query cache
      statusQuery.refetch();
      return {
        status: (data.status || "error") as WcaSessionStatus,
        authenticated: !!data.authenticated,
      };
    } catch (err) {
      console.error("WCA session check failed:", err);
      return null;
    }
  };

  return {
    status: statusQuery.data?.status ?? "checking",
    checkedAt: statusQuery.data?.checkedAt ?? null,
    isLoading: statusQuery.isLoading,
    triggerCheck,
  };
}
