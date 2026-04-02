import { useState, useCallback, useRef } from "react";
import { useLinkedInExtensionBridge } from "./useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { ensureMinDuration, getPatternPause } from "@/hooks/useScrapingSettings";
import {
  buildLinkedInGoogleQueries,
  getEmailDomain,
  normalizeLinkedInProfileUrl,
  pickBestLinkedInCandidate,
  scoreLinkedInCandidate,
} from "@/lib/linkedinSearch";

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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useSmartLinkedInSearch() {
  const liBridge = useLinkedInExtensionBridge();
  const pcBridge = useFireScrapeExtensionBridge();
  const [isSearching, setIsSearching] = useState(false);
  const [searchLog, setSearchLog] = useState<SearchLogEntry[]>([]);
  const abortRef = useRef(false);

  const addLog = useCallback((entry: SearchLogEntry) => {
    setSearchLog(prev => [...prev, entry]);
  }, []);

  /**
   * Build fallback LinkedIn queries for the dedicated LinkedIn extension.
   */
  const buildQueries = (name: string, company?: string | null, email?: string | null, role?: string | null): string[] => {
    const queries: string[] = [];
    const parts = name.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : name;
    const emailDomain = getEmailDomain(email);

    if (company && company !== "—") {
      queries.push(`${name} ${company}`);
    }
    if (emailDomain) {
      queries.push(`${name} ${emailDomain}`);
    }
    queries.push(name);
    if (company && company !== "—" && lastName !== name) {
      queries.push(`${lastName} ${company}`);
    }
    if (role && company && company !== "—") {
      queries.push(`${name} ${role} ${company}`);
    }

    return Array.from(new Set(queries.map(query => query.trim()).filter(Boolean)));
  };

  /**
   * Main search function — Google-first via Partner Connect, LinkedIn extension as fallback.
   */
  const search = useCallback(async (contact: {
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
    let pauseIndex = 0;

    const pushLog = (entry: SearchLogEntry) => {
      log.push(entry);
      addLog(entry);
    };

    const pauseBetweenAttempts = async () => {
      const pause = getPatternPause(pauseIndex);
      pauseIndex += 1;
      await wait(pause * 1000);
    };

    try {
      const googleQueries = buildLinkedInGoogleQueries(contact.name, contact.company, contact.email, contact.role).slice(0, 2);
      const linkedinQueries = buildQueries(contact.name, contact.company, contact.email, contact.role);

      if (pcBridge.isAvailable) {
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
                  ? `Google via Partner Connect: ${candidates.length} profili LinkedIn, migliore "${bestCandidate.name || "sconosciuto"}"${res._fromCache ? " (cache)" : ""}`
                  : `Google via Partner Connect: nessun profilo LinkedIn utile${res._fromCache ? " (cache)" : ""}`
                : res.error || "Ricerca Google fallita",
            };

            pushLog(entry);

            if (bestCandidate && confidence >= 0.5) {
              foundUrl = bestCandidate.profileUrl;
              foundProfile = bestCandidate;
              resolvedMethod = "partner_connect_google_search";
              await ensureMinDuration(opStart);
              break;
            }
          } catch (e) {
            const entry: SearchLogEntry = {
              step: log.length + 1,
              method: "partner_connect_google_search",
              query,
              results: 0,
              match: null,
              confidence: 0,
              ms: Date.now() - opStart,
              reasoning: `Errore: ${(e as Error).message}`,
            };
            pushLog(entry);
          }

          await ensureMinDuration(opStart);

          if (i < googleQueries.length - 1 && !foundUrl && !abortRef.current) {
            await pauseBetweenAttempts();
          }
        }
      }

      let liAuthenticated = false;
      if (!foundUrl && liBridge.isAvailable) {
        try {
          const authCheck = await liBridge.ensureAuthenticated(120000);
          liAuthenticated = authCheck.ok;
          if (!liAuthenticated) {
            console.warn("[SmartSearch] LinkedIn extension available but NOT authenticated:", authCheck.reason);
          }
        } catch {
          liAuthenticated = false;
        }
      }

      if (!foundUrl && liAuthenticated) {
        const maxLinkedInAttempts = pcBridge.isAvailable ? 1 : Math.min(linkedinQueries.length, 3);

        for (let i = 0; i < maxLinkedInAttempts; i++) {
          if (abortRef.current || foundUrl) break;

          const query = linkedinQueries[i];
          const opStart = Date.now();

          try {
            const res = await liBridge.searchProfile(query);
            const ms = Date.now() - opStart;

            if (res.success && res.profile?.profileUrl) {
              const confidence = scoreLinkedInCandidate(res.profile, contact);
              const entry: SearchLogEntry = {
                step: log.length + 1,
                method: "linkedin_people_search",
                query,
                results: 1,
                match: res.profile.profileUrl,
                confidence,
                ms,
                reasoning: `Trovato "${res.profile.name}" — headline: "${res.profile.headline || "n/a"}"`,
              };
              pushLog(entry);

              if (confidence >= 0.5) {
                foundUrl = res.profile.profileUrl;
                foundProfile = res.profile;
                resolvedMethod = "linkedin_people_search";
                await ensureMinDuration(opStart);
                break;
              }
            } else {
              const entry: SearchLogEntry = {
                step: log.length + 1,
                method: "linkedin_people_search",
                query,
                results: 0,
                match: null,
                confidence: 0,
                ms,
                reasoning: res.error || "Nessun risultato",
              };
              pushLog(entry);
            }
          } catch (e) {
            const entry: SearchLogEntry = {
              step: log.length + 1,
              method: "linkedin_people_search",
              query,
              results: 0,
              match: null,
              confidence: 0,
              ms: Date.now() - opStart,
              reasoning: `Errore: ${(e as Error).message}`,
            };
            pushLog(entry);
          }

          await ensureMinDuration(opStart);

          if (i < maxLinkedInAttempts - 1 && !foundUrl && !abortRef.current) {
            await pauseBetweenAttempts();
          }
        }
      }

      if (contact.sourceType && contact.sourceId) {
        try {
          const table = contact.sourceType === "partner_contact" ? "partners" :
                        contact.sourceType === "contact" ? "imported_contacts" : null;

          if (table === "imported_contacts") {
            const { data: ic } = await supabase
              .from("imported_contacts")
              .select("id, enrichment_data")
              .eq("id", contact.sourceId)
              .single();
            if (ic) {
              const existing = (ic.enrichment_data as Record<string, any>) || {};
              await (supabase.from("imported_contacts").update({
                enrichment_data: JSON.parse(JSON.stringify({
                  ...existing,
                  linkedin_search_log: log,
                  linkedin_resolved_at: foundUrl ? new Date().toISOString() : null,
                  linkedin_resolved_method: resolvedMethod,
                  linkedin_profile_url: foundUrl || existing.linkedin_profile_url,
                })),
              }) as any).eq("id", contact.sourceId);
            }
          }
        } catch (e) {
          console.error("[SmartSearch] Failed to persist log:", e);
        }
      }

      return { url: foundUrl, profile: foundProfile, searchLog: log, resolvedMethod };
    } finally {
      setIsSearching(false);
    }
  }, [liBridge, pcBridge, addLog]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { search, isSearching, searchLog, abort };
}
