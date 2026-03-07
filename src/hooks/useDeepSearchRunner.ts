import { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import type { DeepSearchResult, DeepSearchCurrent } from "@/components/operations/DeepSearchCanvas";

export type DeepSearchMode = "partner" | "contact";

export interface DeepSearchState {
  running: boolean;
  canvasOpen: boolean;
  results: DeepSearchResult[];
  current: DeepSearchCurrent | null;
  start: (ids: string[], force?: boolean, mode?: DeepSearchMode) => void;
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

  const start = useCallback(async (ids: string[], force = false, mode: DeepSearchMode = "partner") => {
    if (running || ids.length === 0) return;

    const tableName = mode === "contact" ? "imported_contacts" : "partners";
    const fnName = mode === "contact" ? "deep-search-contact" : "deep-search-partner";
    const bodyKey = mode === "contact" ? "contactId" : "partnerId";

    // Smart filter: check which already have deep_search_at
    let toProcess = ids;
    if (!force) {
      const { data: alreadyDone } = await supabase
        .from(tableName)
        .select("id")
        .in("id", ids)
        .not("deep_search_at", "is", null);

      const doneSet = new Set((alreadyDone || []).map((p: any) => p.id));
      toProcess = ids.filter(id => !doneSet.has(id));
      const skipped = ids.length - toProcess.length;

      if (toProcess.length === 0) {
        toast.info(`Tutti i ${ids.length} record hanno già la Deep Search`, { id: "deep-search-global" });
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

        // Get record info — try cache first, then fetch
        let cached: any = null;
        if (mode === "partner") {
          const allCached = queryClient.getQueriesData<any[]>({ queryKey: queryKeys.partners.all });
          for (const [, data] of allCached) {
            if (Array.isArray(data)) {
              cached = data.flat().find((p: any) => p.id === id);
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
        } else {
          const { data } = await supabase
            .from("imported_contacts")
            .select("id, company_name, name, country")
            .eq("id", id)
            .maybeSingle();
          cached = data ? { company_name: data.name || data.company_name, country_code: data.country } : null;
        }

        // Check abort again after any async operation
        if (abortRef.current) break;

        setCurrent({
          partnerId: id,
          companyName: cached?.company_name || `Record ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          index: done,
          total: toProcess.length,
        });

        toast.loading(`Deep Search ${done}/${toProcess.length}...`, { id: "deep-search-global" });

        const { data, error } = await supabase.functions.invoke(fnName, {
          body: { [bodyKey]: id },
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

        // Live update caches
        if (mode === "contact") {
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          queryClient.invalidateQueries({ queryKey: ["contact-group-items"] });
        } else {
          queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
        }
      }

      const label = mode === "contact" ? "contatti" : "partner";
      const msg = abortRef.current
        ? `Deep Search interrotta: ${processed} ${label} processati`
        : `Deep Search completata: ${processed} ${label}`;
      abortRef.current
        ? toast.info(msg, { id: "deep-search-global" })
        : toast.success(msg, { id: "deep-search-global" });

      if (mode === "contact") {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        queryClient.invalidateQueries({ queryKey: ["all-activities"] });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.countryStats });
      }
    } catch (e: any) {
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
