import { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import type { DeepSearchResult, DeepSearchCurrent } from "@/components/operations/DeepSearchCanvas";

export interface DeepSearchState {
  running: boolean;
  canvasOpen: boolean;
  results: DeepSearchResult[];
  current: DeepSearchCurrent | null;
  start: (partnerIds: string[], force?: boolean) => void;
  stop: () => void;
  setCanvasOpen: (v: boolean) => void;
}

export const DeepSearchContext = createContext<DeepSearchState | null>(null);

export function useDeepSearch(): DeepSearchState {
  const ctx = useContext(DeepSearchContext);
  if (!ctx) throw new Error("useDeepSearch must be used within DeepSearchProvider");
  return ctx;
}

export function useDeepSearchRunner(): DeepSearchState {
  const [running, setRunning] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [results, setResults] = useState<DeepSearchResult[]>([]);
  const [current, setCurrent] = useState<DeepSearchCurrent | null>(null);
  const abortRef = useRef(false);
  const queryClient = useQueryClient();

  const start = useCallback(async (partnerIds: string[], force = false) => {
    if (running || partnerIds.length === 0) return;

    // Smart filter: check which partners already have deep_search_at
    let toProcess = partnerIds;
    if (!force) {
      const { data: alreadyDone } = await supabase
        .from("partners")
        .select("id")
        .in("id", partnerIds)
        .not("enrichment_data->deep_search_at", "is", null);

      const doneSet = new Set((alreadyDone || []).map((p: { id: string }) => p.id));
      toProcess = partnerIds.filter(id => !doneSet.has(id));
      const skipped = partnerIds.length - toProcess.length;

      if (toProcess.length === 0) {
        toast.info(`Tutti i ${partnerIds.length} partner hanno già la Deep Search`, { id: "deep-search-global" });
        return;
      }
      if (skipped > 0) {
        toast.info(`${skipped} già arricchiti, ${toProcess.length} da processare`, { id: "deep-search-global" });
      }
    }

    setRunning(true);
    setResults([]);
    setCanvasOpen(true);
    abortRef.current = false;
    let done = 0;
    let processed = 0;

    try {
      for (const id of toProcess) {
        if (abortRef.current) break;
        done++;

        // Get partner info — try filtered cache first, then fetch if missing
        let cached: Record<string, unknown> | null = null;
        const allCached = queryClient.getQueriesData<any[]>({ queryKey: queryKeys.partners.all });
        for (const [, data] of allCached) {
          if (Array.isArray(data)) {
            cached = data.flat().find((p: { id: string }) => p.id === id);
            if (cached) break;
          }
        }
        if (!cached) {
          const { data } = await supabase
            .from("partners")
            .select("id, company_name, country_code, logo_url")
            .eq("id", id)
            .maybeSingle();
          cached = data;
        }

        // Check abort again after any async operation
        if (abortRef.current) break;

        setCurrent({
          partnerId: id,
          companyName: cached?.company_name || `Partner ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          index: done,
          total: toProcess.length,
        });

        toast.loading(`Deep Search ${done}/${toProcess.length}...`, { id: "deep-search-global" });

        const { data, error } = await supabase.functions.invoke("deep-search-partner", {
          body: { partnerId: id },
        });

        // Check abort immediately after the edge function returns
        if (abortRef.current) {
          processed = done;
          break;
        }

        processed = done;

        const result: DeepSearchResult = {
          partnerId: id,
          companyName: data?.companyName || cached?.company_name || `Partner ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          socialLinksFound: data?.socialLinksFound || 0,
          logoFound: data?.logoFound || false,
          contactProfilesFound: data?.contactProfilesFound || 0,
          companyProfileFound: data?.companyProfileFound || false,
          rating: data?.rating || 0,
          rateLimited: data?.rateLimited,
          error: error ? String(error) : undefined,
        };
        setResults(prev => [...prev, result]);
        if (error) console.error("Deep search error for", id, error);

        // Live update: invalidate partner cache after each partner so cards refresh in real-time
        queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      }

      const msg = abortRef.current
        ? `Deep Search interrotta: ${processed} partner processati`
        : `Deep Search completata: ${processed} partner`;
      abortRef.current
        ? toast.info(msg, { id: "deep-search-global" })
        : toast.success(msg, { id: "deep-search-global" });

      queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.countryStats });
    } catch (e: unknown) {
      toast.error(e?.message || "Errore Deep Search", { id: "deep-search-global" });
    } finally {
      setRunning(false);
      setCurrent(null);
    }
  }, [running, queryClient]);

  const stop = useCallback(() => {
    abortRef.current = true;
    toast.info("Interruzione Deep Search in corso...", { id: "deep-search-global" });
  }, []);

  return { running, canvasOpen, results, current, start, stop, setCanvasOpen };
}
