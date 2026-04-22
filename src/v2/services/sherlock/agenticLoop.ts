/**
 * Agentic loop — iterative decide → scrape → extract cycle.
 */
import { assessPageQuality, reasonLabel } from "./pageQuality";
import { scrapeUrl, makeStepResult } from "./scrapeOperations";
import { extractInternalLinks, normalizeUrl, safeHost } from "./urlUtils";
import { callExtractAI, callDecideAI } from "./aiIntegrations";
import type { SherlockStepResult, SherlockProgressEvent, SherlockChannel } from "./sherlockTypes";

export interface AgenticLoopOptions {
  companyName: string;
  city: string;
  country: string;
  website: string | null;
  budget: number;
  targetFields: string[];
  level: number;
  candidateLinks: string[];
  googleResults: { url: string; title?: string; snippet?: string }[];
  visited: Set<string>;
  consolidated: Record<string, unknown>;
  lastSummary: string;
  signal: AbortSignal;
  throttle?: (channel: SherlockChannel, url: string, signal: AbortSignal) => Promise<void>;
  onProgress?: (event: SherlockProgressEvent) => void;
  onStepResult?: (step: SherlockStepResult) => void;
}

export interface AgenticLoopResult {
  results: SherlockStepResult[];
  candidateLinks: string[];
  googleResults: { url: string; title?: string; snippet?: string }[];
  consolidated: Record<string, unknown>;
  lastSummary: string;
  usedBudget: number;
  stepOrder: number;
}

export async function runAgenticLoop(opts: AgenticLoopOptions): Promise<AgenticLoopResult> {
  const results: SherlockStepResult[] = [];
  let usedBudget = 0;
  let stepOrder = opts.visited.size > 0 ? 2 : 0; // Account for bootstrap steps
  let candidateLinks = [...opts.candidateLinks];
  let googleResults = [...opts.googleResults];
  let lastSummary = opts.lastSummary;
  let consolidated = { ...opts.consolidated };

  while (usedBudget < opts.budget && !opts.signal.aborted) {
    const remaining = opts.budget - usedBudget;

    // Decide what to do next
    let decision;
    try {
      decision = await callDecideAI({
        companyName: opts.companyName,
        city: opts.city,
        country: opts.country,
        website: opts.website,
        budgetRemaining: remaining,
        visitedUrls: Array.from(opts.visited),
        candidateLinks: candidateLinks.filter((u) => !opts.visited.has(u)),
        googleResults: googleResults.filter((r) => !opts.visited.has(r.url)),
        findings: consolidated,
        targetFields: opts.targetFields,
        lastSummary,
        signal: opts.signal,
      });
    } catch (e) {
      console.warn("[agentic] decide failed", e);
      break;
    }

    if (decision.stop || decision.next_actions.length === 0) {
      consolidated._stop_reason = decision.reason || "AI ha deciso di fermarsi";
      break;
    }

    // Process each action
    for (const action of decision.next_actions) {
      if (usedBudget >= opts.budget || opts.signal.aborted) break;

      const norm = normalizeUrl(action.url);
      if (!norm || opts.visited.has(norm)) continue;

      // Hard guard: no direct LinkedIn calls from agentic engine
      if (/(?:^|\.)linkedin\.com$/i.test(safeHost(norm))) {
        opts.visited.add(norm);
        continue;
      }

      opts.visited.add(norm);
      usedBudget++;
      stepOrder++;

      const channel = "generic";
      const startedAt = Date.now();
      const step = makeStepResult({
        order: stepOrder,
        label: action.label || norm,
        url: norm,
        channel,
        startedAt,
      });

      results.push(step);
      if (opts.onStepResult) opts.onStepResult(step);
      if (opts.onProgress) {
        opts.onProgress({
          step: {
            order: step.order,
            label: step.label,
            url_template: step.url ?? "",
            required_vars: [],
            ai_extract_prompt: "",
          },
          result: step,
          totalSteps: opts.budget + 2,
          currentIndex: results.length - 1,
          consolidated: { ...consolidated },
        });
      }

      // Scrape
      const out = await scrapeUrl({
        url: norm,
        channel,
        level: opts.level,
        signal: opts.signal,
        throttle: opts.throttle,
      });

      if (opts.signal.aborted) break;

      if (!out.ok) {
        const updated = { ...step, status: "error" as const, error: out.error, duration_ms: Date.now() - startedAt };
        const idx = results.findIndex((r) => r.order === step.order);
        if (idx >= 0) results[idx] = updated;
        if (opts.onStepResult) opts.onStepResult(updated);
        continue;
      }

      // Quality check
      const quality = assessPageQuality(out.markdown);
      if (!quality.usable) {
        const updated = {
          ...step,
          status: "skipped" as const,
          markdown: "",
          error: reasonLabel(quality.reason),
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
        };
        const idx = results.findIndex((r) => r.order === step.order);
        if (idx >= 0) results[idx] = updated;
        if (opts.onStepResult) opts.onStepResult(updated);
        continue;
      }

      // Update candidates with new links
      try {
        const baseHost = opts.website ? new URL(opts.website).hostname.replace(/^www\./, "") : null;
        const newLinks = extractInternalLinks(out.markdown, baseHost);
        for (const l of newLinks) {
          if (!opts.visited.has(l) && !candidateLinks.includes(l)) candidateLinks.push(l);
        }
        if (candidateLinks.length > 120) candidateLinks = candidateLinks.slice(-120);
      } catch {
        /* noop */
      }

      // AI extraction
      try {
        const ai = await callExtractAI({
          markdown: out.markdown,
          label: action.label || norm,
          targetFields: opts.targetFields,
          priorFindings: consolidated,
          signal: opts.signal,
        });

        Object.entries(ai.findings).forEach(([k, v]) => {
          if (!k.startsWith("_") && v !== null && v !== undefined && v !== "") consolidated[k] = v;
        });
        lastSummary = ai.summary || lastSummary;

        const updated = {
          ...step,
          status: out.cacheHit ? ("cached" as const) : ("done" as const),
          markdown: out.markdown,
          findings: { ...ai.findings, _summary: ai.summary, _why: action.why },
          confidence: ai.confidence,
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
        };
        const idx = results.findIndex((r) => r.order === step.order);
        if (idx >= 0) results[idx] = updated;
        if (opts.onStepResult) opts.onStepResult(updated);
      } catch (e) {
        const updated = {
          ...step,
          status: "done" as const,
          markdown: out.markdown,
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
          error: `AI extract: ${e instanceof Error ? e.message : "errore"}`,
        };
        const idx = results.findIndex((r) => r.order === step.order);
        if (idx >= 0) results[idx] = updated;
        if (opts.onStepResult) opts.onStepResult(updated);
      }
    }
  }

  return {
    results,
    candidateLinks,
    googleResults,
    consolidated,
    lastSummary,
    usedBudget,
    stepOrder,
  };
}
