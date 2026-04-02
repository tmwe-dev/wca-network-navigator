import { useState, useCallback, useRef } from "react";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { useLinkedInExtensionBridge } from "./useLinkedInExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ensureMinDuration, getPatternPause } from "@/hooks/useScrapingSettings";
import {
  buildLinkedInGoogleQueries,
  normalizeLinkedInProfileUrl,
  pickBestLinkedInCandidate,
  scoreLinkedInCandidate,
} from "@/lib/linkedinSearch";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Get existing LinkedIn URL from enrichment_data (check all known fields) */
const getExistingLinkedInUrl = (enrichmentData: Record<string, any> | null): string | null => {
  if (!enrichmentData) return null;
  // Canonical field first, then legacy
  return enrichmentData.linkedin_profile_url
    || enrichmentData.linkedin_url
    || enrichmentData.social_links?.linkedin
    || null;
};

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
  const liBridge = useLinkedInExtensionBridge();
  const [progress, setProgress] = useState<LookupProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);

  const lookupBatch = useCallback(async (contactIds: string[]) => {
    if (!pcBridge.isAvailable && !liBridge.isAvailable) {
      toast({ title: "Nessuna estensione disponibile", description: "Installa Partner Connect o l'estensione LinkedIn", variant: "destructive" });
      return;
    }
    if (!contactIds.length) return;

    abortRef.current = false;

    // Fetch contacts
    const { data: contacts, error } = await supabase
      .from("imported_contacts")
      .select("id, name, company_name, email, enrichment_data")
      .in("id", contactIds.slice(0, 500));

    if (error || !contacts?.length) {
      toast({ title: "Nessun contatto trovato", variant: "destructive" });
      return;
    }

    // Filter: skip those already with a LinkedIn URL (check ALL known fields)
    const toProcess = contacts.filter(c => {
      const ed = (c.enrichment_data as Record<string, any>) || {};
      return !getExistingLinkedInUrl(ed);
    });

    const skippedCount = contacts.length - toProcess.length;
    const total = toProcess.length;

    setProgress({ current: 0, total, currentName: "", found: 0, notFound: 0, skipped: skippedCount, status: "running" });
    toast({ title: `Trova profilo LinkedIn`, description: `${total} da cercare, ${skippedCount} già risolti` });

    // Check LinkedIn auth once upfront for fallback
    let liAuthOk = false;
    if (liBridge.isAvailable) {
      try {
        const authCheck = await liBridge.ensureAuthenticated(120000);
        liAuthOk = authCheck.ok;
      } catch { liAuthOk = false; }
    }

    let found = 0, notFound = 0, pauseIdx = 0;

    for (let i = 0; i < toProcess.length; i++) {
      if (abortRef.current) {
        setProgress(p => ({ ...p, status: "aborted" }));
        toast({ title: "LinkedIn Lookup interrotto", description: `${found} trovati, ${notFound} non trovati` });
        return;
      }

      const c = toProcess[i];
      const searchName = c.name || c.company_name || "";
      if (!searchName.trim()) { notFound++; continue; }

      setProgress(p => ({ ...p, current: i + 1, currentName: searchName }));

      const opStart = Date.now();
      let foundUrl: string | null = null;
      let resolvedMethod: string | null = null;

      // ── Strategy 1: Google via Partner Connect ──
      if (pcBridge.isAvailable && !foundUrl) {
        setProgress(p => ({ ...p, currentMethod: "Partner Connect" }));
        const queries = buildLinkedInGoogleQueries(searchName, c.company_name, c.email);

        for (const query of queries) {
          if (abortRef.current || foundUrl) break;
          try {
            const res = await pcBridge.googleSearch(query, 5);
            const rawResults = res.success && Array.isArray(res.data) ? res.data : [];
            const { candidate, confidence } = pickBestLinkedInCandidate(rawResults, {
              name: searchName,
              company: c.company_name,
            });

            if (candidate && confidence >= 0.5) {
              foundUrl = candidate.profileUrl;
              resolvedMethod = "partner_connect_google_search";
              break;
            }
          } catch (e) {
            console.warn("[LinkedInLookup] Google search error:", e);
          }
        }
      }

      // ── Strategy 2: LinkedIn People Search (fallback) ──
      if (!foundUrl && liAuthOk) {
        setProgress(p => ({ ...p, currentMethod: "LinkedIn Search" }));
        try {
          const res = await liBridge.searchProfile(searchName + (c.company_name ? ` ${c.company_name}` : ""));
          const normalizedProfileUrl = normalizeLinkedInProfileUrl(res.profile?.profileUrl);
          if (res.success && normalizedProfileUrl) {
            const confidence = scoreLinkedInCandidate({
              name: res.profile?.name,
              headline: res.profile?.headline,
              profileUrl: normalizedProfileUrl,
            }, {
              name: searchName,
              company: c.company_name,
            });
            if (confidence >= 0.5) {
              foundUrl = normalizedProfileUrl;
              resolvedMethod = "linkedin_people_search";
            }
          }
        } catch (e) {
          console.warn("[LinkedInLookup] LinkedIn search fallback error:", e);
        }
      }

      // ── Save result using CANONICAL field ──
      const existing = (c.enrichment_data as Record<string, any>) || {};
      const updated = {
        ...existing,
        linkedin_lookup_at: new Date().toISOString(),
        linkedin_resolved_method: resolvedMethod,
        ...(foundUrl ? { linkedin_profile_url: foundUrl, linkedin_url: foundUrl } : {}),
      };

      await (supabase.from("imported_contacts").update({ enrichment_data: JSON.parse(JSON.stringify(updated)) }) as any).eq("id", c.id);

      if (foundUrl) found++; else notFound++;
      setProgress(p => ({ ...p, found, notFound, currentMethod: undefined }));

      // Ensure min duration + pattern pause
      await ensureMinDuration(opStart);
      if (i < toProcess.length - 1 && !abortRef.current) {
        const pause = getPatternPause(pauseIdx);
        pauseIdx++;
        await wait(pause * 1000);
      }
    }

    setProgress(p => ({ ...p, status: "done" }));
    toast({ title: "Trova profilo LinkedIn completato", description: `${found} trovati, ${notFound} non trovati, ${skippedCount} già risolti` });
  }, [pcBridge, liBridge]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { lookupBatch, progress, abort, isAvailable: pcBridge.isAvailable || liBridge.isAvailable };
}
