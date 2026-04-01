import { useState, useCallback, useRef } from "react";
import { useLinkedInExtensionBridge } from "./useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { ensureMinDuration, getPatternPause } from "@/hooks/useScrapingSettings";

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

type GoogleSearchItem = {
  url: string;
  title?: string;
  description?: string;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isLinkedInProfileUrl = (url?: string | null): boolean => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isLinkedInHost =
      hostname === "linkedin.com" ||
      hostname === "www.linkedin.com" ||
      hostname.endsWith(".linkedin.com");

    return isLinkedInHost && /^\/(in|pub)\//.test(parsed.pathname);
  } catch {
    return false;
  }
};

const normalizeLinkedInProfileUrl = (url?: string | null): string | null => {
  if (!isLinkedInProfileUrl(url)) return null;

  try {
    const parsed = new URL(url!);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
};

const cleanGoogleLinkedInTitle = (title?: string): string => {
  if (!title) return "";

  return title
    .replace(/\s+[|·•]\s+LinkedIn.*$/i, "")
    .replace(/\s+-\s+LinkedIn.*$/i, "")
    .trim();
};

const extractGoogleCandidate = (item: GoogleSearchItem): SmartSearchResult["profile"] => {
  const profileUrl = normalizeLinkedInProfileUrl(item.url);
  if (!profileUrl) return null;

  const cleanedTitle = cleanGoogleLinkedInTitle(item.title);
  const name = cleanedTitle.split(/\s+[|–—-]\s+/)[0]?.trim() || cleanedTitle;
  const headlineParts = [
    cleanedTitle && cleanedTitle !== name ? cleanedTitle : "",
    item.description?.trim() || "",
  ].filter(Boolean);

  return {
    name: name || undefined,
    headline: headlineParts.join(" — ") || item.description?.trim() || undefined,
    profileUrl,
  };
};

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
   * Extract email domain (skip generic providers)
   */
  const getEmailDomain = (email?: string | null): string | null => {
    if (!email) return null;
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return null;
    const generic = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "aol.com", "mail.com", "protonmail.com", "libero.it", "virgilio.it", "alice.it", "tin.it", "fastwebnet.it", "tiscali.it", "email.it", "pec.it"];
    return generic.includes(domain) ? null : domain;
  };

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
   * Build Google queries for Partner Connect.
   * Google is the first attempt because it often gives the profile URL directly.
   */
  const buildGoogleQueries = (name: string, company?: string | null, email?: string | null, role?: string | null): string[] => {
    const queries: string[] = [];
    const emailDomain = getEmailDomain(email);

    if (company && company !== "—") {
      queries.push(`site:linkedin.com/in "${name}" "${company}"`);
    }
    if (role && company && company !== "—") {
      queries.push(`site:linkedin.com/in "${name}" "${role}" "${company}"`);
    }
    if (emailDomain) {
      queries.push(`site:linkedin.com/in "${name}" "${emailDomain}"`);
    }
    queries.push(`site:linkedin.com/in "${name}"`);

    return Array.from(new Set(queries.map(query => query.replace(/\s+/g, " ").trim()).filter(Boolean)));
  };

  /**
   * Validate if a found profile matches our contact using basic heuristics
   */
  const validateMatch = (found: { name?: string; headline?: string; profileUrl?: string }, expected: { name: string; company?: string | null; role?: string | null }): number => {
    if (!found.profileUrl) return 0;
    let score = 0.3; // base score for having a URL

    const foundName = (found.name || "").toLowerCase();
    const expectedName = expected.name.toLowerCase();
    const expectedParts = expectedName.split(/\s+/);

    if (foundName.includes(expectedName) || expectedName.includes(foundName)) {
      score += 0.4;
    } else if (expectedParts.some(p => p.length > 2 && foundName.includes(p))) {
      score += 0.2;
    }

    const headline = (found.headline || "").toLowerCase();
    if (expected.company && expected.company !== "—") {
      const companyLower = expected.company.toLowerCase();
      const companyWords = companyLower.split(/\s+/).filter(w => w.length > 3);
      if (headline.includes(companyLower) || companyWords.some(w => headline.includes(w))) {
        score += 0.25;
      }
    }

    if (expected.role) {
      const roleLower = expected.role.toLowerCase();
      if (headline.includes(roleLower)) score += 0.05;
    }

    return Math.min(score, 1);
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
      const googleQueries = buildGoogleQueries(contact.name, contact.company, contact.email, contact.role).slice(0, 2);
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
            const candidates = rawResults
              .map(extractGoogleCandidate)
              .filter((candidate): candidate is NonNullable<SmartSearchResult["profile"]> => Boolean(candidate?.profileUrl));

            const scored = candidates
              .map(candidate => ({
                candidate,
                confidence: validateMatch(candidate, contact),
              }))
              .sort((a, b) => b.confidence - a.confidence);

            const best = scored[0];
            const entry: SearchLogEntry = {
              step: log.length + 1,
              method: "partner_connect_google_search",
              query,
              results: candidates.length,
              match: best?.candidate.profileUrl || null,
              confidence: best?.confidence || 0,
              ms,
              reasoning: res.success
                ? best
                  ? `Google via Partner Connect: ${candidates.length} profili LinkedIn, migliore "${best.candidate.name || "sconosciuto"}"${res._fromCache ? " (cache)" : ""}`
                  : `Google via Partner Connect: nessun profilo LinkedIn utile${res._fromCache ? " (cache)" : ""}`
                : res.error || "Ricerca Google fallita",
            };

            pushLog(entry);

            if (best && best.confidence >= 0.5 && best.candidate.profileUrl) {
              foundUrl = best.candidate.profileUrl;
              foundProfile = best.candidate;
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
              const confidence = validateMatch(res.profile, contact);
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
