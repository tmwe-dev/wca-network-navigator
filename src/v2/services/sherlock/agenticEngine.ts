/**
 * agenticEngine — orchestrator "plan → fetch → observe → decide → repeat".
 *
 * Refactored to use focused modules:
 * - bootstrapSteps: home + Google search
 * - agenticLoop: iterative decide → scrape → extract
 * - urlUtils, cacheManager, aiIntegrations, scrapeOperations
 */
import { throttle } from "./rateLimiter";
import { bootstrapHome, bootstrapGoogleSearch } from "./bootstrapSteps";
import { runAgenticLoop } from "./agenticLoop";
import { buildFinalSummary } from "./scrapeOperations";
import type {
  SherlockLevel,
  SherlockStepResult,
  SherlockProgressEvent,
} from "./sherlockTypes";

const BUDGET_BY_LEVEL: Record<SherlockLevel, number> = {
  1: 3,  // Scout — fast
  2: 6,  // Detective — standard
  3: 10, // Sherlock — deep
};

const TARGET_FIELDS_BY_LEVEL: Record<SherlockLevel, string[]> = {
  1: ["company_name", "main_services", "website", "address", "phone"],
  2: [
    "company_name",
    "main_services",
    "website",
    "address",
    "phone",
    "email",
    "ceo_or_owner",
    "founded_year",
    "team_size",
    "linkedin_url",
  ],
  3: [
    "company_name",
    "main_services",
    "website",
    "address",
    "phone",
    "email",
    "ceo_or_owner",
    "founded_year",
    "team_size",
    "linkedin_url",
    "decision_maker",
    "decision_maker_linkedin",
    "fleet_or_assets",
    "client_segments",
    "geographic_coverage",
    "recent_news",
    "reputation_signals",
  ],
};

export interface RunAgenticOptions {
  level: SherlockLevel;
  vars: Record<string, string>; // companyName, city, country, websiteUrl?
  partnerId: string | null;
  contactId: string | null;
  signal: AbortSignal;
  onProgress: (event: SherlockProgressEvent) => void;
}

export interface AgenticRunResult {
  results: SherlockStepResult[];
  consolidated: Record<string, unknown>;
  summary: string;
  durationMs: number;
}

export async function runAgenticSherlock(opts: RunAgenticOptions): Promise<AgenticRunResult> {
  const { level, vars, signal, onProgress, partnerId } = opts;
  const startTs = Date.now();
  const budget = BUDGET_BY_LEVEL[level];
  const targetFields = TARGET_FIELDS_BY_LEVEL[level];

  const companyName = vars.companyName ?? "";
  const city = vars.city ?? "";
  const country = vars.country ?? "";
  let website = vars.websiteUrl ? normalizeUrl(vars.websiteUrl) : null;

  const results: SherlockStepResult[] = [];
  const consolidated: Record<string, unknown> = {};
  const visited = new Set<string>();

  // Helper: normalize URL
  function normalizeUrl(raw: string): string | null {
    try {
      const u = new URL(raw);
      if (!/^https?:$/.test(u.protocol)) return null;
      u.hash = "";
      let s = u.toString();
      if (s.endsWith("/")) s = s.slice(0, -1);
      return s;
    } catch {
      return null;
    }
  }

  // Emit helper
  const emit = (step: SherlockStepResult) => {
    const idx = results.findIndex((r) => r.order === step.order);
    if (idx >= 0) results[idx] = step;
    else results.push(step);
    onProgress({
      step: {
        order: step.order,
        label: step.label,
        url_template: step.url ?? "",
        required_vars: [],
        ai_extract_prompt: "",
      },
      result: step,
      totalSteps: budget + 2,
      currentIndex: results.length - 1,
      consolidated: { ...consolidated },
    });
  };

  // ── BOOTSTRAP 1: Home page
  let candidateLinks: string[] = [];
  let googleResults: { url: string; title?: string; snippet?: string }[] = [];
  let lastSummary = "";

  if (website) {
    const bootHome = await bootstrapHome({
      website,
      companyName,
      level,
      targetFields,
      partnerId,
      signal,
      throttle: (channel, url, sig) => throttle(channel, url, sig),
      onProgress: emit,
    });

    results.push(...bootHome.results);
    candidateLinks = bootHome.candidateLinks;
    Object.assign(consolidated, bootHome.consolidated);
    lastSummary = bootHome.lastSummary;
    visited.add(website);

    if (signal.aborted) {
      return finishRun(results, consolidated, startTs);
    }
  }

  // ── BOOTSTRAP 2: Google search
  if (companyName && !signal.aborted) {
    const bootGoogle = await bootstrapGoogleSearch({
      companyName,
      city,
      country,
      website,
      level,
      signal,
      throttle: (channel, url, sig) => throttle(channel, url, sig),
      onProgress: emit,
      partnerId,
    });

    results.push(...bootGoogle.results);
    website = bootGoogle.website;
    googleResults = bootGoogle.googleResults;
    Object.assign(consolidated, bootGoogle.consolidated);
    lastSummary = bootGoogle.lastSummary;

    const q = encodeURIComponent(
      `"${companyName}"${city ? ` ${city}` : ""}${country ? ` ${country}` : ""}`,
    );
    const gUrl = `https://www.google.com/search?q=${q}`;
    visited.add(gUrl);

    if (signal.aborted) {
      return finishRun(results, consolidated, startTs);
    }
  }

  // ── AGENTIC LOOP
  if (!signal.aborted) {
    const loopResult = await runAgenticLoop({
      companyName,
      city,
      country,
      website,
      budget,
      targetFields,
      level,
      candidateLinks,
      googleResults,
      visited,
      consolidated,
      lastSummary,
      signal,
      throttle: (channel, url, sig) => throttle(channel, url, sig),
      onProgress,
      onStepResult: emit,
    });

    results.push(...loopResult.results);
    Object.assign(consolidated, loopResult.consolidated);
  }

  return finishRun(results, consolidated, startTs);
}

function finishRun(
  results: SherlockStepResult[],
  consolidated: Record<string, unknown>,
  startTs: number,
): AgenticRunResult {
  const sorted = [...results].sort((a, b) => a.order - b.order);
  return {
    results: sorted,
    consolidated,
    summary: buildFinalSummary(consolidated, sorted),
    durationMs: Date.now() - startTs,
  };
}
