import { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DeepSearchResult, DeepSearchCurrent } from "@/components/operations/DeepSearchCanvas";

export interface DeepSearchState {
  running: boolean;
  canvasOpen: boolean;
  results: DeepSearchResult[];
  current: DeepSearchCurrent | null;
  start: (partnerIds: string[]) => void;
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

  const start = useCallback(async (partnerIds: string[]) => {
    if (running || partnerIds.length === 0) return;
    setRunning(true);
    setResults([]);
    setCanvasOpen(true);
    abortRef.current = false;
    let done = 0;

    try {
      for (const id of partnerIds) {
        if (abortRef.current) break;
        done++;

        // Get partner info from cache
        const cached = queryClient.getQueryData<any[]>(["partners"])
          ?.flat()?.find((p: any) => p.id === id);

        setCurrent({
          partnerId: id,
          companyName: cached?.company_name || `Partner ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          index: done,
          total: partnerIds.length,
        });

        toast.loading(`Deep Search ${done}/${partnerIds.length}...`, { id: "deep-search-global" });

        const { data, error } = await supabase.functions.invoke("deep-search-partner", {
          body: { partnerId: id },
        });

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
      }

      const msg = abortRef.current
        ? `Deep Search interrotta: ${done} partner processati`
        : `Deep Search completata: ${done} partner`;
      abortRef.current
        ? toast.info(msg, { id: "deep-search-global" })
        : toast.success(msg, { id: "deep-search-global" });

      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["country-stats"] });
    } catch (e: any) {
      toast.error(e?.message || "Errore Deep Search", { id: "deep-search-global" });
    } finally {
      setRunning(false);
      setCurrent(null);
    }
  }, [running, queryClient]);

  const stop = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { running, canvasOpen, results, current, start, stop, setCanvasOpen };
}
