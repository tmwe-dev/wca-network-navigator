import { useState, useCallback, useRef } from "react";
import { useLinkedInExtensionBridge } from "./useLinkedInExtensionBridge";
import { supabase } from "@/integrations/supabase/client";

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

export function useSmartLinkedInSearch() {
  const liBridge = useLinkedInExtensionBridge();
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
   * Build search queries based on available contact data — AI-flexible approach
   */
  const buildQueries = (name: string, company?: string | null, email?: string | null, role?: string | null): string[] => {
    const queries: string[] = [];
    const parts = name.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : name;
    const emailDomain = getEmailDomain(email);

    // 1. Full name + company on LinkedIn
    if (company && company !== "—") {
      queries.push(`${name} ${company}`);
    }
    // 2. Full name + email domain
    if (emailDomain) {
      queries.push(`${name} ${emailDomain}`);
    }
    // 3. Full name alone
    queries.push(name);
    // 4. Last name + company
    if (company && company !== "—" && lastName !== name) {
      queries.push(`${lastName} ${company}`);
    }
    // 5. Name + role for disambiguation
    if (role && company && company !== "—") {
      queries.push(`${name} ${role} ${company}`);
    }

    return queries;
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

    // Name match
    if (foundName.includes(expectedName) || expectedName.includes(foundName)) {
      score += 0.4;
    } else if (expectedParts.some(p => p.length > 2 && foundName.includes(p))) {
      score += 0.2;
    }

    // Company/headline match
    const headline = (found.headline || "").toLowerCase();
    if (expected.company && expected.company !== "—") {
      const companyLower = expected.company.toLowerCase();
      const companyWords = companyLower.split(/\s+/).filter(w => w.length > 3);
      if (headline.includes(companyLower) || companyWords.some(w => headline.includes(w))) {
        score += 0.25;
      }
    }

    // Role match
    if (expected.role) {
      const roleLower = expected.role.toLowerCase();
      if (headline.includes(roleLower)) score += 0.05;
    }

    return Math.min(score, 1);
  };

  /**
   * Main search function — cascading with AI-like flexibility
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

    const queries = buildQueries(contact.name, contact.company, contact.email, contact.role);

    // Try LinkedIn People Search via extension (most reliable)
    // Use long cache TTL — caller should have already verified session
    let liAuthenticated = false;
    if (liBridge.isAvailable) {
      try {
        const authCheck = await liBridge.ensureAuthenticated(120000); // 2min cache — avoid re-verifying during batch
        liAuthenticated = authCheck.ok;
        if (!liAuthenticated) {
          console.warn("[SmartSearch] LinkedIn extension available but NOT authenticated:", authCheck.reason);
        }
      } catch {
        liAuthenticated = false;
      }
    }

    if (liAuthenticated) {
      for (let i = 0; i < Math.min(queries.length, 4); i++) {
        if (abortRef.current) break;
        if (foundUrl) break;

        const query = queries[i];
        const start = Date.now();

        try {
          const res = await liBridge.searchProfile(query);
          const ms = Date.now() - start;

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
            log.push(entry);
            addLog(entry);

            if (confidence >= 0.5) {
              foundUrl = res.profile.profileUrl;
              foundProfile = res.profile;
              resolvedMethod = "linkedin_people_search";
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
            log.push(entry);
            addLog(entry);
          }
        } catch (e) {
          const entry: SearchLogEntry = {
            step: log.length + 1,
            method: "linkedin_people_search",
            query,
            results: 0,
            match: null,
            confidence: 0,
            ms: Date.now() - start,
            reasoning: `Errore: ${(e as Error).message}`,
          };
          log.push(entry);
          addLog(entry);
        }

        // Small delay between queries
        if (!foundUrl && i < queries.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    // Save search log to DB if we have a source
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

    setIsSearching(false);
    return { url: foundUrl, profile: foundProfile, searchLog: log, resolvedMethod };
  }, [liBridge, addLog]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { search, isSearching, searchLog, abort };
}
