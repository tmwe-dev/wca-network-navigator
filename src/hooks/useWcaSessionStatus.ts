// WCA session status hook — uses Extension Bridge as primary verification method
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";

export type WcaSessionStatus = "ok" | "expired" | "unknown" | "no_cookie" | "checking" | "error";

export type CheckStep = "idle" | "syncing_cookie" | "verifying_session" | "updating_db" | "done";

export interface WcaDiagnostics {
  hasAspxAuth?: boolean;
  membersOnlyCount?: number;
  contactsTotal?: number;
  contactsWithRealName?: number;
  contactsWithEmail?: number;
  method?: string;
  reason?: string;
}

export function useWcaSessionStatus() {
  const [isChecking, setIsChecking] = useState(false);
  const [checkStep, setCheckStep] = useState<CheckStep>("idle");
  const [diagnostics, setDiagnostics] = useState<WcaDiagnostics | null>(null);
  const queryClient = useQueryClient();
  const { isAvailable: extensionAvailable, syncCookie, verifySession, checkAvailable } = useExtensionBridge();

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
    refetchInterval: 5 * 60 * 1000,
  });

  // Update session status in DB via edge function
  const updateStatusInDb = useCallback(async (status: string, source: string) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-wca-session`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ status, source }),
      });
    } catch (err) {
      console.error("Failed to update WCA status in DB:", err);
    }
  }, []);

  const triggerCheck = useCallback(async (): Promise<{ status: WcaSessionStatus; authenticated: boolean; diagnostics?: WcaDiagnostics } | null> => {
    setIsChecking(true);
    setCheckStep("idle");

    try {
      // Try extension bridge first (primary method)
      const extAvailable = extensionAvailable || await checkAvailable();

      if (extAvailable) {
        // Step 1: Sync cookies from browser to server
        setCheckStep("syncing_cookie");
        await syncCookie();

        // Step 2: Verify session by opening a real WCA profile
        setCheckStep("verifying_session");
        const verifyResult = await verifySession();

        const authenticated = verifyResult.success && verifyResult.authenticated === true;
        const finalStatus: WcaSessionStatus = authenticated ? "ok" : "expired";
        const diag: WcaDiagnostics = {
          method: "extension_verify",
          reason: verifyResult.reason || (authenticated ? "real_contacts_visible" : "no_real_contacts"),
        };

        // Step 3: Update DB with the real result
        setCheckStep("updating_db");
        await updateStatusInDb(finalStatus, "extension_verify");

        setDiagnostics(diag);
        setCheckStep("done");
        queryClient.invalidateQueries({ queryKey: ["wca-session-status"] });

        return { status: finalStatus, authenticated, diagnostics: diag };
      }

      // Fallback: use edge function check (DB-only, no extension)
      setCheckStep("verifying_session");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-wca-session`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await res.json();
      const diag: WcaDiagnostics = {
        hasAspxAuth: data.hasAspxAuth,
        method: "edge_function_fallback",
        reason: data.jobSignal || data.reason,
      };
      setDiagnostics(diag);
      setCheckStep("done");
      queryClient.invalidateQueries({ queryKey: ["wca-session-status"] });

      return {
        status: (data.status || "error") as WcaSessionStatus,
        authenticated: !!data.authenticated,
        diagnostics: diag,
      };
    } catch (err) {
      console.error("WCA session check failed:", err);
      setCheckStep("done");
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [extensionAvailable, checkAvailable, syncCookie, verifySession, updateStatusInDb, queryClient]);

  // Auto-check on mount: if status is not "ok", automatically verify via extension
  const autoCheckDone = useRef(false);
  const triggerCheckRef = useRef(triggerCheck);
  triggerCheckRef.current = triggerCheck;

  useEffect(() => {
    if (autoCheckDone.current) return;
    if (statusQuery.isLoading) return;
    const currentStatus = statusQuery.data?.status;
    if (currentStatus && currentStatus !== "ok" && currentStatus !== "checking") {
      autoCheckDone.current = true;
      const timer = setTimeout(() => {
        triggerCheckRef.current();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [statusQuery.isLoading, statusQuery.data?.status]);

  return {
    status: statusQuery.data?.status ?? "checking",
    checkedAt: statusQuery.data?.checkedAt ?? null,
    diagnostics,
    isLoading: statusQuery.isLoading,
    isChecking,
    checkStep,
    triggerCheck,
  };
}
