import { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import type { DeepSearchResult, DeepSearchCurrent } from "@/components/operations/DeepSearchCanvas";
import { useDeepSearchLocal } from "./useDeepSearchLocal";
import { createLogger } from "@/lib/log";

const log = createLogger("useDeepSearchRunner");

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
  const localSearch = useDeepSearchLocal();

  const start = useCallback(async (ids: string[], force = false, mode: DeepSearchMode = "partner") => {
    if (running || ids.length === 0) return;

    // ── Partner Connect is now REQUIRED ──
    if (!localSearch.isAvailable) {
      toast.error("🔌 Installa l'estensione Partner Connect per eseguire la Deep Search. Nessun fallback server disponibile.", {
        id: "deep-search-global",
        duration: 8000,
      });
      return;
    }

    // ── Pre-check: for partners, detect missing profiles ──
    let noProfileIds: string[] = [];
    if (mode === "partner") {
      const batchSize = 100;
      const allPartnerData: any[] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data } = await supabase
          .from("partners")
          .select("id, raw_profile_html, enrichment_data")
          .in("id", batch);
        if (data) allPartnerData.push(...data);
      }

      noProfileIds = allPartnerData
        .filter((p: any) => !p.raw_profile_html)
        .map((p: any) => p.id);

      if (noProfileIds.length > 0 && noProfileIds.length === ids.length) {
        toast.warning(
          `Tutti i ${ids.length} partner sono senza profilo WCA. Scarica prima i profili dal Download Center, poi esegui la Deep Search.`,
          { id: "deep-search-global", duration: 8000 }
        );
        return;
      }

      if (noProfileIds.length > 0) {
        const withProfile = ids.length - noProfileIds.length;
        toast.warning(
          `${noProfileIds.length} partner senza profilo WCA (saltati). Deep Search su ${withProfile} con profilo.`,
          { id: "deep-search-global", duration: 6000 }
        );
      }
    }

    // Smart filter: check which already have deep_search_at
    let toProcess = mode === "partner"
      ? ids.filter(id => !noProfileIds.includes(id))
      : [...ids];

    if (!force) {
      let alreadyDone: any[] | null = null;
      if (mode === "contact") {
        const { getContactsByIds } = await import("@/data/contacts");
        const allContacts = await getContactsByIds(toProcess, "id, deep_search_at");
        alreadyDone = allContacts.filter((c: any) => c.deep_search_at);
      } else {
        const { data } = await supabase
          .from("partners")
          .select("id, enrichment_data")
          .in("id", toProcess);
        alreadyDone = (data || []).filter((p: any) => p.enrichment_data?.deep_search_at);
      }

      const doneSet = new Set((alreadyDone || []).map((p: any) => p.id));
      const beforeCount = toProcess.length;
      toProcess = toProcess.filter(id => !doneSet.has(id));
      const skipped = beforeCount - toProcess.length;

      if (toProcess.length === 0) {
        const noProfileMsg = noProfileIds.length > 0 ? ` (${noProfileIds.length} senza profilo)` : "";
        toast.info(`Tutti i record hanno già la Deep Search${noProfileMsg}`, { id: "deep-search-global" });
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

    toast.info("🔌 Partner Connect attivo — Deep Search client-side (zero costi API)", { id: "deep-search-global", duration: 4000 });

    try {
      for (const id of toProcess) {
        if (abortRef.current) break;
        done++;

        // Get record info
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
          const { getContactsByIds: fetchContacts } = await import("@/data/contacts");
          const results = await fetchContacts([id], "id, company_name, name, country");
          const data = results[0] || null;
          cached = data ? { company_name: data.name || data.company_name, country_code: data.country } : null;
        }

        if (abortRef.current) break;

        setCurrent({
          partnerId: id,
          companyName: cached?.company_name || `Record ${done}`,
          countryCode: cached?.country_code,
          logoUrl: cached?.logo_url,
          index: done,
          total: toProcess.length,
        });

        toast.loading(`Deep Search ${done}/${toProcess.length} 🔥...`, { id: "deep-search-global" });

        let data: any = null;
        let error: any = null;

        try {
          if (mode === "contact") {
            data = await localSearch.searchContact(id);
          } else {
            data = await localSearch.searchPartner(id);
          }
          if (!data.success) error = data.error;
        } catch (e: any) {
          error = e?.message || "Partner Connect error";
        }

        if (abortRef.current) {
          processed = done;
          break;
        }

        processed = done;

        const result: DeepSearchResult = {
          partnerId: id,
          companyName: data?.companyName || cached?.company_name || `Record ${done}`,
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
        if (error) log.error("deep search failed", { id, message: error instanceof Error ? error.message : String(error) });

        // Live update caches
        if (mode === "contact") {
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          queryClient.invalidateQueries({ queryKey: ["contact-group-items"] });
          queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
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
  }, [running, queryClient, localSearch]);

  const stop = useCallback(() => {
    abortRef.current = true;
    toast.info("Interruzione Deep Search in corso...", { id: "deep-search-global" });
  }, []);

  return { running, canvasOpen, results, current, start, stop, setCanvasOpen };
}
