import { useState, useCallback, useRef } from "react";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ensureMinDuration, getPatternPause } from "@/hooks/useScrapingSettings";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const isLinkedInProfileUrl = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const p = new URL(url);
    const h = p.hostname.toLowerCase();
    return (h === "linkedin.com" || h === "www.linkedin.com" || h.endsWith(".linkedin.com")) && /^\/(in|pub)\//.test(p.pathname);
  } catch { return false; }
};

const normalizeUrl = (url: string): string => {
  try { const p = new URL(url); return `${p.protocol}//${p.hostname}${p.pathname}`.replace(/\/$/, ""); } catch { return url; }
};

const getEmailDomain = (email?: string | null): string | null => {
  if (!email) return null;
  const d = email.split("@")[1]?.toLowerCase();
  if (!d) return null;
  const generic = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "aol.com", "mail.com", "protonmail.com", "libero.it", "virgilio.it", "alice.it", "tin.it", "fastwebnet.it", "tiscali.it", "email.it", "pec.it"];
  return generic.includes(d) ? null : d;
};

export interface LookupProgress {
  current: number;
  total: number;
  currentName: string;
  found: number;
  notFound: number;
  skipped: number;
  status: "idle" | "running" | "done" | "aborted";
}

const INITIAL_PROGRESS: LookupProgress = { current: 0, total: 0, currentName: "", found: 0, notFound: 0, skipped: 0, status: "idle" };

export function useLinkedInLookup() {
  const pcBridge = useFireScrapeExtensionBridge();
  const [progress, setProgress] = useState<LookupProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);

  const buildGoogleQuery = (name: string, company?: string | null, email?: string | null): string[] => {
    const queries: string[] = [];
    const emailDomain = getEmailDomain(email);
    if (company && company !== "—") queries.push(`site:linkedin.com/in "${name}" "${company}"`);
    if (emailDomain) queries.push(`site:linkedin.com/in "${name}" "${emailDomain}"`);
    if (!queries.length) queries.push(`site:linkedin.com/in "${name}"`);
    return queries;
  };

  const validateMatch = (title: string, description: string, expectedName: string, expectedCompany?: string | null): number => {
    const text = `${title} ${description}`.toLowerCase();
    const nameLower = expectedName.toLowerCase();
    const nameParts = nameLower.split(/\s+/).filter(w => w.length > 2);
    let score = 0.3;
    if (text.includes(nameLower)) score += 0.4;
    else if (nameParts.some(p => text.includes(p))) score += 0.2;
    if (expectedCompany && expectedCompany !== "—") {
      const cLower = expectedCompany.toLowerCase();
      const cWords = cLower.split(/\s+/).filter(w => w.length > 3);
      if (text.includes(cLower) || cWords.some(w => text.includes(w))) score += 0.25;
    }
    return Math.min(score, 1);
  };

  const lookupBatch = useCallback(async (contactIds: string[]) => {
    if (!pcBridge.isAvailable) {
      toast({ title: "Partner Connect non disponibile", description: "Installa e attiva l'estensione Partner Connect", variant: "destructive" });
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

    // Filter: skip those already with linkedin_url
    const toProcess = contacts.filter(c => {
      const ed = (c.enrichment_data as Record<string, any>) || {};
      return !ed.linkedin_url;
    });

    const skippedCount = contacts.length - toProcess.length;
    const total = toProcess.length;

    setProgress({ current: 0, total, currentName: "", found: 0, notFound: 0, skipped: skippedCount, status: "running" });
    toast({ title: `LinkedIn Lookup avviato`, description: `${total} contatti da cercare, ${skippedCount} già risolti` });

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
      const queries = buildGoogleQuery(searchName, c.company_name, c.email);
      let foundUrl: string | null = null;

      for (const query of queries) {
        if (abortRef.current || foundUrl) break;
        try {
          const res = await pcBridge.googleSearch(query, 5);
          if (res.success && Array.isArray(res.data)) {
            for (const item of res.data) {
              if (!isLinkedInProfileUrl(item.url)) continue;
              const confidence = validateMatch(item.title || "", item.description || "", searchName, c.company_name);
              if (confidence >= 0.5) {
                foundUrl = normalizeUrl(item.url);
                break;
              }
            }
          }
        } catch (e) {
          console.warn("[LinkedInLookup] Google search error:", e);
        }
      }

      // Save result
      const existing = (c.enrichment_data as Record<string, any>) || {};
      const updated = {
        ...existing,
        linkedin_lookup_at: new Date().toISOString(),
        ...(foundUrl ? { linkedin_url: foundUrl } : {}),
      };

      await (supabase.from("imported_contacts").update({ enrichment_data: JSON.parse(JSON.stringify(updated)) }) as any).eq("id", c.id);

      if (foundUrl) found++; else notFound++;
      setProgress(p => ({ ...p, found, notFound }));

      // Ensure min duration + pattern pause
      await ensureMinDuration(opStart);
      if (i < toProcess.length - 1 && !abortRef.current) {
        const pause = getPatternPause(pauseIdx);
        pauseIdx++;
        await wait(pause * 1000);
      }
    }

    setProgress(p => ({ ...p, status: "done" }));
    toast({ title: "LinkedIn Lookup completato", description: `${found} trovati, ${notFound} non trovati, ${skippedCount} già risolti` });
  }, [pcBridge]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { lookupBatch, progress, abort, isAvailable: pcBridge.isAvailable };
}
