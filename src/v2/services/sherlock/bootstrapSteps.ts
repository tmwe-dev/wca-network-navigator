/**
 * Bootstrap steps — home page fetch and Google search.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  updatePartnerWebsiteIfMissing,
  updatePartnerLinkedinIfMissing,
} from "@/data/sherlockPlaybooks";
import { assessPageQuality, reasonLabel } from "./pageQuality";
import { scrapeUrl, makeStepResult } from "./scrapeOperations";
import { extractInternalLinks, extractGoogleResults, normalizeUrl, detectLinkedinCompanyUrl } from "./urlUtils";
import { callExtractAI } from "./aiIntegrations";
import type { SherlockStepResult } from "./sherlockTypes";

export interface BootstrapResult {
  website: string | null;
  candidateLinks: string[];
  googleResults: { url: string; title?: string; snippet?: string }[];
  consolidated: Record<string, unknown>;
  lastSummary: string;
  results: SherlockStepResult[];
  stepOrder: number;
}

export async function bootstrapHome(args: {
  website: string | null;
  companyName: string;
  level: number;
  targetFields: string[];
  partnerId: string | null;
  signal: AbortSignal;
  throttle?: (channel: any, url: string, signal: AbortSignal) => Promise<void>;
  onProgress?: (step: SherlockStepResult) => void;
}): Promise<{
  website: string | null;
  candidateLinks: string[];
  consolidated: Record<string, unknown>;
  lastSummary: string;
  results: SherlockStepResult[];
  stepOrder: number;
}> {
  const results: SherlockStepResult[] = [];
  const consolidated: Record<string, unknown> = {};
  let candidateLinks: string[] = [];
  let lastSummary = "";
  let stepOrder = 0;

  if (!args.website) {
    return { website: null, candidateLinks: [], consolidated: {}, lastSummary: "", results, stepOrder };
  }

  stepOrder++;
  const startedAt = Date.now();
  const step = makeStepResult({ order: stepOrder, label: "Sito — Home", url: args.website, startedAt });
  results.push(step);
  if (args.onProgress) args.onProgress(step);

  const out = await scrapeUrl({ url: args.website, channel: "generic", level: args.level, signal: args.signal, throttle: args.throttle });

  if (!out.ok) {
    const failed = { ...step, status: "error" as const, error: out.error ?? "Scrape fallito", duration_ms: Date.now() - startedAt };
    results[0] = failed;
    if (args.onProgress) args.onProgress(failed);
    return { website: args.website, candidateLinks: [], consolidated: {}, lastSummary: "", results, stepOrder };
  }

  const quality = assessPageQuality(out.markdown);
  if (!quality.usable) {
    const skipped = {
      ...step,
      status: "skipped" as const,
      markdown: "",
      error: reasonLabel(quality.reason) + " — " + quality.detail,
      duration_ms: Date.now() - startedAt,
      cache_hit: out.cacheHit,
    };
    results[0] = skipped;
    if (args.onProgress) args.onProgress(skipped);
    return { website: args.website, candidateLinks: [], consolidated: {}, lastSummary: "", results, stepOrder };
  }

  // Extract internal links and LinkedIn URL
  let baseHost: string | null = null;
  try {
    baseHost = new URL(args.website).hostname.replace(/^www\./, "");
  } catch {
    /* noop */
  }

  candidateLinks = extractInternalLinks(out.markdown, baseHost);
  const liUrl = detectLinkedinCompanyUrl(out.markdown);
  if (liUrl && args.partnerId) {
    updatePartnerLinkedinIfMissing(args.partnerId, liUrl).catch(() => null);
    consolidated.linkedin_company_url = liUrl;
  }

  // Extract data via AI
  try {
    const ai = await callExtractAI({
      markdown: out.markdown,
      label: "Sito — Home",
      targetFields: args.targetFields,
      priorFindings: consolidated,
      signal: args.signal,
    });

    Object.entries(ai.findings).forEach(([k, v]) => {
      if (!k.startsWith("_") && v !== null && v !== undefined && v !== "") consolidated[k] = v;
    });
    lastSummary = ai.summary;

    const done = {
      ...step,
      status: out.cacheHit ? ("cached" as const) : ("done" as const),
      markdown: out.markdown,
      findings: { ...ai.findings, _summary: ai.summary },
      confidence: ai.confidence,
      duration_ms: Date.now() - startedAt,
      cache_hit: out.cacheHit,
    };
    results[0] = done;
    if (args.onProgress) args.onProgress(done);
  } catch (e) {
    const failed = {
      ...step,
      status: "done" as const,
      markdown: out.markdown,
      duration_ms: Date.now() - startedAt,
      cache_hit: out.cacheHit,
      error: `AI extract: ${e instanceof Error ? e.message : "errore"}`,
    };
    results[0] = failed;
    if (args.onProgress) args.onProgress(failed);
  }

  return { website: args.website, candidateLinks, consolidated, lastSummary, results, stepOrder };
}

export async function bootstrapGoogleSearch(args: {
  companyName: string;
  city: string;
  country: string;
  website: string | null;
  level: number;
  signal: AbortSignal;
  throttle?: (channel: any, url: string, signal: AbortSignal) => Promise<void>;
  onProgress?: (step: SherlockStepResult) => void;
  partnerId: string | null;
}): Promise<{
  website: string | null;
  googleResults: { url: string; title?: string; snippet?: string }[];
  consolidated: Record<string, unknown>;
  lastSummary: string;
  results: SherlockStepResult[];
  stepOrder: number;
}> {
  const results: SherlockStepResult[] = [];
  const consolidated: Record<string, unknown> = {};
  let googleResults: { url: string; title?: string; snippet?: string }[] = [];
  let lastSummary = "";
  let stepOrder = 1; // Continue from bootstrap
  let website = args.website;

  if (!args.companyName || args.signal.aborted) {
    return { website, googleResults: [], consolidated: {}, lastSummary: "", results, stepOrder };
  }

  stepOrder++;
  const q = encodeURIComponent(`"${args.companyName}"${args.city ? ` ${args.city}` : ""}${args.country ? ` ${args.country}` : ""}`);
  const gUrl = `https://www.google.com/search?q=${q}`;
  const startedAt = Date.now();
  const step = makeStepResult({ order: stepOrder, label: `Google — "${args.companyName}"`, url: gUrl, startedAt });
  results.push(step);
  if (args.onProgress) args.onProgress(step);

  const out = await scrapeUrl({ url: gUrl, channel: "generic", level: args.level, signal: args.signal, throttle: args.throttle });

  if (!out.ok) {
    const failed = { ...step, status: "error" as const, error: out.error, duration_ms: Date.now() - startedAt };
    results[0] = failed;
    if (args.onProgress) args.onProgress(failed);
    return { website, googleResults: [], consolidated: {}, lastSummary: "", results, stepOrder };
  }

  const quality = assessPageQuality(out.markdown);
  if (!quality.usable) {
    const skipped = {
      ...step,
      status: "skipped" as const,
      error: reasonLabel(quality.reason) + " — " + quality.detail,
      duration_ms: Date.now() - startedAt,
      cache_hit: out.cacheHit,
    };
    results[0] = skipped;
    if (args.onProgress) args.onProgress(skipped);
    return { website, googleResults: [], consolidated: {}, lastSummary: "", results, stepOrder };
  }

  googleResults = extractGoogleResults(out.markdown);

  // If no website, try to find one from Google results
  if (!website) {
    const candidate = googleResults.find((r) => {
      const host = new URL(r.url).hostname.toLowerCase();
      return !["linkedin.com", "facebook.com", "wikipedia.org"].some((d) => host.includes(d));
    })?.url;

    if (candidate) {
      const norm = normalizeUrl(candidate);
      if (norm) {
        try {
          const u = new URL(norm);
          website = `${u.protocol}//${u.hostname}`;
          consolidated.website = website;
          if (args.partnerId) updatePartnerWebsiteIfMissing(args.partnerId, website).catch(() => null);
        } catch {
          /* noop */
        }
      }
    }
  }

  const done = {
    ...step,
    status: out.cacheHit ? ("cached" as const) : ("done" as const),
    markdown: out.markdown,
    findings: { _summary: `${googleResults.length} risultati indicizzati per "${args.companyName}"` },
    duration_ms: Date.now() - startedAt,
    cache_hit: out.cacheHit,
  };
  results[0] = done;
  if (args.onProgress) args.onProgress(done);

  lastSummary = `Google ha restituito ${googleResults.length} risultati per "${args.companyName}".`;

  return { website, googleResults, consolidated, lastSummary, results, stepOrder };
}
