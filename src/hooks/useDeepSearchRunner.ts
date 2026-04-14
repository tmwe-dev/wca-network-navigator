import { createContext, useContext, useState, useCallback, useRef } from "react";
import { getPartnersByIds } from "@/data/partners";
import { getContactsByIds } from "@/data/contacts";
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

const STEP_TIMEOUT_MS = 60_000;

interface PartnerFilterRow { id: string; raw_profile_html?: string | null; enrichment_data?: Record<string, unknown> | null }
interface PartnerInfoRow { id: string; company_name?: string; country_code?: string; logo_url?: string }
interface ContactInfoRow { id: string; company_name?: string | null; name?: string | null; country?: string | null }
interface DeepSearchAlreadyDoneRow { id: string; deep_search_at?: string | null; enrichment_data?: Record<string, unknown> | null }
interface LocalSearchResult { success: boolean; error?: string; companyName?: string; socialLinksFound?: number; logoFound?: boolean; contactProfilesFound?: number; companyProfileFound?: boolean; rating?: number; rateLimited?: boolean }

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
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

    if (!localSearch.isAvailable) {
      toast.error("🔌 Installa l'estensione Partner Connect per eseguire la Deep Search. Nessun fallback server disponibile.", {
        id: "deep-search-global", duration: 8000,
      });
      return;
    }

    // Pre-check: for partners, detect missing profiles
    let noProfileIds: string[] = [];
    if (mode === "partner") {
      const allPartnerData = await getPartnersByIds(ids, "id, raw_profile_html, enrichment_data") as unknown as PartnerFilterRow[];

      noProfileIds = allPartnerData
        .filter((p) => !p.raw_profile_html)
        .map((p) => p.id);

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
      let alreadyDone: DeepSearchAlreadyDoneRow[] = [];
      if (mode === "contact") {
        const allContacts = await getContactsByIds(toProcess, "id, deep_search_at") as unknown as DeepSearchAlreadyDoneRow[];
        alreadyDone = allContacts.filter((c) => c.deep_search_at);
      } else {
        const partnerData = await getPartnersByIds(toProcess, "id, enrichment_data") as unknown as DeepSearchAlreadyDoneRow[];
        alreadyDone = partnerData.filter((p) => p.enrichment_data?.deep_search_at);
      }

      const doneSet = new Set(alreadyDone.map((p) => p.id));
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
        let cached: PartnerInfoRow | ContactInfoRow | null = null;
        if (mode === "partner") {
          const allCached = queryClient.getQueriesData<PartnerInfoRow[]>({ queryKey: queryKeys.partners.all });
          for (const [, data] of allCached) {
            if (Array.isArray(data)) {
              const flat = (data as PartnerInfoRow[]).flat();
              cached = flat.find((p) => p.id === id) || null;
              if (cached) break;
            }
          }
          if (!cached) {
            const partnerResults = await getPartnersByIds([id], "id, company_name, country_code, logo_url") as unknown as PartnerInfoRow[];
            cached = partnerResults[0] || null;
          }
        } else {
          const contactResults = await getContactsByIds([id], "id, company_name, name, country") as unknown as ContactInfoRow[];
          const data = contactResults[0] || null;
          cached = data ? { id: data.id, company_name: data.name || data.company_name || undefined, country_code: data.country || undefined } as PartnerInfoRow : null;
        }

        if (abortRef.current) break;

        setCurrent({
          partnerId: id,
          companyName: (cached as PartnerInfoRow | null)?.company_name || `Record ${done}`,
          countryCode: (cached as PartnerInfoRow | null)?.country_code,
          logoUrl: (cached as PartnerInfoRow | null)?.logo_url,
          index: done,
          total: toProcess.length,
        });

        toast.loading(`Deep Search ${done}/${toProcess.length} 🔥...`, { id: "deep-search-global" });

        let data: LocalSearchResult | null = null;
        let error: string | null = null;

        try {
          const searchPromise = mode === "contact"
            ? localSearch.searchContact(id)
            : localSearch.searchPartner(id);
          
          const rawResult = await withTimeout(searchPromise, STEP_TIMEOUT_MS);
          if (rawResult === null) {
            error = `Timeout after ${STEP_TIMEOUT_MS / 1000}s`;
          } else {
            data = rawResult as LocalSearchResult;
            if (!data.success) error = data.error || "Search failed";
          }
        } catch (e: unknown) {
          error = e instanceof Error ? e.message : "Partner Connect error";
        }

        if (abortRef.current) {
          processed = done;
          break;
        }

        processed = done;

        const result: DeepSearchResult = {
          partnerId: id,
          companyName: data?.companyName || (cached as PartnerInfoRow | null)?.company_name || `Record ${done}`,
          countryCode: (cached as PartnerInfoRow | null)?.country_code,
          logoUrl: (cached as PartnerInfoRow | null)?.logo_url,
          socialLinksFound: data?.socialLinksFound || 0,
          logoFound: data?.logoFound || false,
          contactProfilesFound: data?.contactProfilesFound || 0,
          companyProfileFound: data?.companyProfileFound || false,
          rating: data?.rating || 0,
          rateLimited: data?.rateLimited,
          error: error || undefined,
        };
        setResults(prev => [...prev, result]);
        if (error) log.error("deep search failed", { id, message: error });

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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore Deep Search", { id: "deep-search-global" });
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
