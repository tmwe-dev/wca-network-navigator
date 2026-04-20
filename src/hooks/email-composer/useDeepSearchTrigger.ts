/**
 * useDeepSearchTrigger — manual on-demand Deep Search for a partner.
 * Calls enrich-partner-website edge function and tracks status.
 */
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { asEnrichmentData } from "@/lib/types/enrichmentData";

export type DeepSearchStatus = "idle" | "missing" | "stale" | "fresh" | "running" | "failed";

export interface DeepSearchState {
  status: DeepSearchStatus;
  ageDays: number | null;
  scrapedAt: string | null;
}

const STALE_THRESHOLD_DAYS = 30;

function computeStatus(scrapedAt: string | null | undefined): { status: DeepSearchStatus; ageDays: number | null } {
  if (!scrapedAt) return { status: "missing", ageDays: null };
  const age = Math.floor((Date.now() - new Date(scrapedAt).getTime()) / 86400000);
  return { status: age > STALE_THRESHOLD_DAYS ? "stale" : "fresh", ageDays: age };
}

export function useDeepSearchTrigger(partnerId: string | null) {
  const [state, setState] = useState<DeepSearchState>({ status: "idle", ageDays: null, scrapedAt: null });
  const [refreshTick, setRefreshTick] = useState(0);

  // Load current cache status when partnerId changes
  useEffect(() => {
    if (!partnerId || partnerId.length !== 36) {
      setState({ status: "idle", ageDays: null, scrapedAt: null });
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("partners")
        .select("enrichment_data")
        .eq("id", partnerId)
        .maybeSingle();
      if (!active) return;
      const enr = asEnrichmentData(data?.enrichment_data);
      const scrapedAt = (enr.deep_search_at as string | undefined) || (enr.scraped_at as string | undefined) || null;
      const { status, ageDays } = computeStatus(scrapedAt);
      setState({ status, ageDays, scrapedAt });
    })();
    return () => { active = false; };
  }, [partnerId, refreshTick]);

  const trigger = useCallback(async () => {
    if (!partnerId || partnerId.length !== 36) {
      toast.error("Deep Search richiede un partner CRM identificato");
      return;
    }
    setState((s) => ({ ...s, status: "running" }));
    try {
      await invokeEdge("enrich-partner-website", {
        body: { partnerId },
        context: "OraclePanel.deepSearch",
      });
      toast.success("Deep Search completata 🔍");
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setState((s) => ({ ...s, status: "failed" }));
      toast.error("Errore Deep Search: " + (err instanceof Error ? err.message : "sconosciuto"));
    }
  }, [partnerId]);

  return { ...state, trigger, canRun: !!(partnerId && partnerId.length === 36) };
}
