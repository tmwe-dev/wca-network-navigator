import { useState, useCallback, useRef } from "react";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { toast } from "@/hooks/use-toast";
import { ensureMinDuration, getPatternPause } from "@/hooks/useScrapingSettings";
import { buildLinkedInGoogleQueries, pickBestLinkedInCandidate } from "@/lib/linkedinSearch";
import { createLogger } from "@/lib/log";

const moduleLog = createLogger("useLinkedInLookup");

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Get existing LinkedIn URL from enrichment_data (check all known fields) */
const getExistingLinkedInUrl = (enrichmentData: Record<string, any> | null): string | null => {
  if (!enrichmentData) return null;
  return enrichmentData.linkedin_profile_url
    || enrichmentData.linkedin_url
    || enrichmentData.social_links?.linkedin
    || null;
};

export interface SearchLogEntry {
  step: number;
  method: string;
  query: string;
  results: number;
  match: string | null;
  confidence: number;
  ms: number;
  reasoning?: string;
}

export interface SmartSearchResult {
  url: string | null;
  profile: {
    name?: string;
    headline?: string;
    location?: string;
    about?: string;
    photoUrl?: string;
    profileUrl?: string;
  } | null;
  searchLog: SearchLogEntry[];
  resolvedMethod: string | null;
}

export interface LookupProgress {
  current: number;
  total: number;
  currentName: string;
  found: number;
  notFound: number;
  skipped: number;
  status: "idle" | "running" | "done" | "aborted";
  currentMethod?: string;
}

const INITIAL_PROGRESS: LookupProgress = { current: 0, total: 0, currentName: "", found: 0, notFound: 0, skipped: 0, status: "idle" };

export function useLinkedInLookup() {
  const pcBridge = useFireScrapeExtensionBridge();
  const [progress, setProgress] = useState<LookupProgress>(INITIAL_PROGRESS);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLog, setSearchLog] = useState<SearchLogEntry[]>([]);
  const abortRef = useRef(false);

  // ── Single contact search (Google-only via Partner Connect) ──
  const searchSingle = useCallback(async (contact: {
    name: string;
    company?: string | null;
    email?: string | null;
    role?: string | null;
    country?: string | null;
    sourceType?: string;
    sourceId?: string;
  }): Promise<SmartSearchResult> => {
    setIsSearching(true);
    setSearchLog([]);
    abortRef.current = false;

    const log: SearchLogEntry[] = [];
    let foundUrl: string | null = null;
    let foundProfile: SmartSearchResult["profile"] = null;
    let resolvedMethod: string | null = null;

    try {
      if (!pcBridge.isAvailable) {
        return { url: null, profile: null, searchLog: [], resolvedMethod: null };
      }

      const googleQueries = buildLinkedInGoogleQueries(contact.name, contact.company, contact.email, contact.role).slice(0, 3);

      for (let i = 0; i < googleQueries.length; i++) {
        if (abortRef.current || foundUrl) break;

        const query = googleQueries[i];
        const opStart = Date.now();

        try {
          const res = await pcBridge.googleSearch(query, 5);
          const ms = Date.now() - opStart;
          const rawResults = res.success && Array.isArray(res.data) ? res.data : [];
          const { candidate: bestCandidate, confidence, candidates } = pickBestLinkedInCandidate(rawResults, contact);

          const entry: SearchLogEntry = {
            step: log.length + 1,
            method: "partner_connect_google_search",
            query,
            results: candidates.length,
            match: bestCandidate?.profileUrl || null,
            confidence,
            ms,
            reasoning: res.success
              ? bestCandidate
                ? `Google: ${candidates.length} profili LinkedIn, migliore "${bestCandidate.name || "?"}"${res._fromCache ? " (cache)" : ""}`
                : `Google: nessun profilo LinkedIn utile${res._fromCache ? " (cache)" : ""}`
              : res.error || "Ricerca Google fallita",
          };

          log.push(entry);
          setSearchLog([...log]);

          if (bestCandidate && confidence >= 0.5) {
            foundUrl = bestCandidate.profileUrl;
            foundProfile = bestCandidate;
            resolvedMethod = "partner_connect_google_search";
            break;
          }
        } catch (e) {
          log.push({
            step: log.length + 1,
            method: "partner_connect_google_search",
            query,
            results: 0,
            match: null,
            confidence: 0,
            ms: Date.now() - opStart,
            reasoning: `Errore: ${(e as Error).message}`,
          });
          setSearchLog([...log]);
        }

        await ensureMinDuration(opStart);
        if (i < googleQueries.length - 1 && !foundUrl && !abortRef.current) {
          const pause = getPatternPause(i);
          await wait(pause * 1000);
        }
      }

      // Persist result
      if (contact.sourceType && contact.sourceId && contact.sourceType === "contact") {
        try {
          const { updateContactEnrichment } = await import("@/data/contacts");
          {
            await updateContactEnrichment(contact.sourceId, {
              linkedin_search_log: log,
              linkedin_resolved_at: foundUrl ? new Date().toISOString() : null,
              linkedin_resolved_method: resolvedMethod,
              linkedin_profile_url: foundUrl || null,
              ...(foundUrl ? { linkedin_url: foundUrl } : {}),
            });
          }
        } catch (e) {
          moduleLog.error("persist log failed", { message: e instanceof Error ? e.message : String(e) });
        }
      }

      return { url: foundUrl, profile: foundProfile, searchLog: log, resolvedMethod };
    } finally {
      setIsSearching(false);
    }
  }, [pcBridge]);

  // ── Batch lookup (Google-only via Partner Connect) ──
  const lookupBatch = useCallback(async (contactIds: string[]) => {
    if (!pcBridge.isAvailable) {
      toast({ title: "Partner Connect non disponibile", description: "Installa l'estensione Partner Connect", variant: "destructive" });
      return;
    }
    if (!contactIds.length) return;

    abortRef.current = false;

    const { getContactsByIds } = await import("@/data/contacts");
    const contacts = await getContactsByIds(contactIds.slice(0, 500), "id, name, company_name, email, enrichment_data");
    const error = null;

    if (error || !contacts?.length) {
      toast({ title: "Nessun contatto trovato", variant: "destructive" });
      return;
    }

    const toProcess = contacts.filter(c => {
      const ed = (c.enrichment_data as Record<string, any>) || {};
      return !getExistingLinkedInUrl(ed);
    });

    const skippedCount = contacts.length - toProcess.length;
    const total = toProcess.length;

    setProgress({ current: 0, total, currentName: "", found: 0, notFound: 0, skipped: skippedCount, status: "running" });
    toast({ title: `Trova profilo LinkedIn`, description: `${total} da cercare, ${skippedCount} già risolti` });

    let found = 0, notFound = 0, pauseIdx = 0;

    for (let i = 0; i < toProcess.length; i++) {
      if (abortRef.current) {
        setProgress(p => ({ ...p, status: "aborted" }));
        toast({ title: "LinkedIn Lookup interrotto", description: `${found} trovati, ${notFound} non trovati` });
        return;
      }

      const c = toProcess[i];
      const searchName = String(c.name || c.company_name || "");
      if (!searchName.trim()) { notFound++; continue; }

      setProgress(p => ({ ...p, current: i + 1, currentName: searchName, currentMethod: "Google Search" }));

      const opStart = Date.now();
      let foundUrl: string | null = null;
      let resolvedMethod: string | null = null;

      // Google-only via Partner Connect
      const queries = buildLinkedInGoogleQueries(searchName, String(c.company_name ?? ""), String(c.email ?? ""));

      for (const query of queries) {
        if (abortRef.current || foundUrl) break;
        try {
          const res = await pcBridge.googleSearch(query, 5);
          const rawResults = res.success && Array.isArray(res.data) ? res.data : [];
          const { candidate, confidence } = pickBestLinkedInCandidate(rawResults, {
            name: searchName,
            company: String(c.company_name ?? ""),
          });

          if (candidate && confidence >= 0.5) {
            foundUrl = candidate.profileUrl;
            resolvedMethod = "partner_connect_google_search";
            break;
          }
        } catch (e) {
          moduleLog.warn("google search error", { message: e instanceof Error ? e.message : String(e) });
        }
      }

      // Save result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic enrichment data
      const existing = (c.enrichment_data as any) || {};
      const updated = {
        ...existing,
        linkedin_lookup_at: new Date().toISOString(),
        linkedin_resolved_method: resolvedMethod,
        ...(foundUrl ? { linkedin_profile_url: foundUrl, linkedin_url: foundUrl } : {}),
      };

      const { updateContactEnrichment: updateEnrich } = await import("@/data/contacts");
      await updateEnrich(c.id as string, updated);

      if (foundUrl) found++; else notFound++;
      setProgress(p => ({ ...p, found, notFound, currentMethod: undefined as string | undefined }));

      await ensureMinDuration(opStart);
      if (i < toProcess.length - 1 && !abortRef.current) {
        const pause = getPatternPause(pauseIdx);
        pauseIdx++;
        await wait(pause * 1000);
      }
    }

    setProgress(p => ({ ...p, status: "done" }));
    toast({ title: "Trova profilo LinkedIn completato", description: `${found} trovati, ${notFound} non trovati, ${skippedCount} già risolti` });
  }, [pcBridge]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { searchSingle, lookupBatch, progress, abort, isAvailable: pcBridge.isAvailable, isSearching, searchLog };
}
