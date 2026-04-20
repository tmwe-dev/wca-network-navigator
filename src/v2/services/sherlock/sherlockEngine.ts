/**
 * sherlockEngine — orchestratore sequenziale di un playbook investigativo.
 *
 * Per ogni step:
 *  1) renderizza url_template con vars
 *  2) verifica required_vars (skip se mancanti)
 *  3) pre-check scrape_cache (TTL 7gg)
 *  4) se miss → fs.readUrl(url) + persist scrape_cache
 *  5) chiama edge function sherlock-extract per findings AI
 *  6) emette progress
 *  7) se step ha ai_decide_next + AI ritorna suggested_next_url → lo espone
 *      come var speciale { decisionMakerLinkedinUrl } per step successivi
 *
 * AbortSignal propagato a tutto.
 */
import { fs as extFs } from "@/v2/io/extensions/bridge";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { updatePartnerWebsiteIfMissing } from "@/data/sherlockPlaybooks";
import { renderUrlTemplate, checkRequiredVars } from "./sherlockTemplates";
import type {
  SherlockPlaybook,
  SherlockStep,
  SherlockStepResult,
  SherlockProgressEvent,
} from "./sherlockTypes";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function extractMarkdown(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.markdown === "string") return d.markdown;
  if (typeof d.content === "string") return d.content;
  if (d.result && typeof d.result === "object") {
    const r = d.result as Record<string, unknown>;
    if (typeof r.markdown === "string") return r.markdown;
  }
  return "";
}

async function checkCache(url: string): Promise<{ markdown: string; scrapedAt: string } | null> {
  try {
    const { data } = await untypedFrom("scrape_cache")
      .select("payload, scraped_at")
      .eq("url", url)
      .maybeSingle();
    if (!data) return null;
    const scrapedAt = (data as { scraped_at: string }).scraped_at;
    const age = Date.now() - new Date(scrapedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    const payload = (data as { payload: { markdown?: string } }).payload;
    if (!payload?.markdown) return null;
    return { markdown: payload.markdown, scrapedAt };
  } catch {
    return null;
  }
}

async function persistScrape(args: {
  url: string;
  markdown: string;
  level: number;
  partnerId: string | null;
  contactId: string | null;
}): Promise<void> {
  try {
    await untypedFrom("scrape_cache").upsert({
      url: args.url,
      mode: "static",
      payload: {
        markdown: args.markdown,
        source: "sherlock",
        level: args.level,
        partner_id: args.partnerId,
        contact_id: args.contactId,
        captured_at: new Date().toISOString(),
      },
      scraped_at: new Date().toISOString(),
    });
  } catch {
    /* non-blocking */
  }
}

async function callExtractAI(args: {
  markdown: string;
  step: SherlockStep;
  targetFields: string[];
  priorFindings: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<{ findings: Record<string, unknown>; confidence: number; suggestedNextUrl: string | null; summary: string }> {
  const { data, error } = await supabase.functions.invoke("sherlock-extract", {
    body: {
      markdown: args.markdown,
      extract_prompt: args.step.ai_extract_prompt,
      target_fields: args.targetFields,
      prior_findings: args.priorFindings,
      label: args.step.label,
    },
  });
  if (args.signal.aborted) throw new Error("Aborted");
  if (error) throw new Error(error.message ?? "AI extract failed");
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    findings: (d.fields as Record<string, unknown>) ?? {},
    confidence: typeof d.confidence === "number" ? d.confidence : 0,
    suggestedNextUrl: typeof d.suggested_next_url === "string" ? d.suggested_next_url : null,
    summary: typeof d.summary === "string" ? d.summary : "",
  };
}

export interface RunSherlockOptions {
  playbook: SherlockPlaybook;
  vars: Record<string, string>;
  partnerId: string | null;
  contactId: string | null;
  signal: AbortSignal;
  onProgress: (event: SherlockProgressEvent) => void;
}

export interface SherlockRunResult {
  results: SherlockStepResult[];
  consolidated: Record<string, unknown>;
  summary: string;
  durationMs: number;
}

const AGGREGATOR_DOMAINS = [
  "google.", "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "youtube.com", "wikipedia.org", "wikiwand.com", "yelp.com", "tripadvisor.",
  "pagine", "europages.", "kompass.", "yellowpages.", "bing.com", "duckduckgo.",
  "amazon.", "ebay.", "indeed.", "glassdoor.",
];

function pickFirstNonAggregatorUrl(markdown: string): string | null {
  if (!markdown) return null;
  // Match http(s) URLs; tolerate trailing punctuation
  const re = /https?:\/\/[^\s)<>"'\]]+/gi;
  const matches = markdown.match(re) ?? [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[)\].,;:!?]+$/, "");
    try {
      const u = new URL(cleaned);
      const host = u.hostname.toLowerCase();
      if (AGGREGATOR_DOMAINS.some((d) => host.includes(d))) continue;
      // Esci sul primo dominio "candidato sito ufficiale"
      return `${u.protocol}//${u.hostname}`;
    } catch {
      continue;
    }
  }
  return null;
}

async function discoverWebsiteViaGoogle(args: {
  companyName: string;
  city: string;
  signal: AbortSignal;
}): Promise<string | null> {
  const { companyName, city, signal } = args;
  if (!companyName) return null;
  const q = encodeURIComponent(`${companyName} ${city} sito ufficiale`.trim());
  const url = `https://www.google.com/search?q=${q}`;
  try {
    const cached = await checkCache(url);
    let markdown = cached?.markdown ?? "";
    if (!markdown) {
      const res = await extFs.readUrl(url, { settleMs: 2000, signal, skipCache: true });
      if (signal.aborted || !res.ok) return null;
      markdown = extractMarkdown(res.data);
      if (markdown) {
        await persistScrape({ url, markdown, level: 0, partnerId: null, contactId: null });
      }
    }
    return pickFirstNonAggregatorUrl(markdown);
  } catch {
    return null;
  }
}

export async function runSherlock(opts: RunSherlockOptions): Promise<SherlockRunResult> {
  const { playbook, signal, onProgress, partnerId, contactId } = opts;
  const startTs = Date.now();
  const liveVars: Record<string, string> = { ...opts.vars };
  const results: SherlockStepResult[] = [];
  const consolidated: Record<string, unknown> = {};

  // ── DISCOVERY: se il playbook richiede websiteUrl ma manca, prova a scoprirlo via Google.
  const playbookNeedsWebsite = playbook.steps.some((s) => (s.required_vars ?? []).includes("websiteUrl"));
  if (playbookNeedsWebsite && !liveVars.websiteUrl && liveVars.companyName) {
    const discovered = await discoverWebsiteViaGoogle({
      companyName: liveVars.companyName,
      city: liveVars.city ?? "",
      signal,
    });
    if (discovered) {
      liveVars.websiteUrl = discovered;
      consolidated.website_discovered = discovered;
      // Persisti sul partner se vuoto, così le indagini future sono complete.
      if (partnerId) {
        updatePartnerWebsiteIfMissing(partnerId, discovered).catch(() => null);
      }
    }
  }

  for (let i = 0; i < playbook.steps.length; i++) {
    if (signal.aborted) break;
    const step = playbook.steps[i];
    const stepStart = Date.now();

    // 1. required vars check
    const reqCheck = checkRequiredVars(step.required_vars ?? [], liveVars);
    if (!reqCheck.ok) {
      const skipped: SherlockStepResult = {
        order: step.order,
        label: step.label,
        url: null,
        channel: step.channel ?? "generic",
        status: "skipped",
        markdown: "",
        findings: {},
        confidence: null,
        suggested_next_url: null,
        error: `Variabili mancanti: ${reqCheck.missing.join(", ")}`,
        started_at: stepStart,
        duration_ms: 0,
      };
      results.push(skipped);
      onProgress({ step, result: skipped, totalSteps: playbook.steps.length, currentIndex: i, consolidated });
      continue;
    }

    // 2. render url
    const { url } = renderUrlTemplate(step.url_template, liveVars);
    const channel = step.channel ?? "generic";

    // 3. running emit
    const running: SherlockStepResult = {
      order: step.order,
      label: step.label,
      url,
      channel,
      status: "running",
      markdown: "",
      findings: {},
      confidence: null,
      suggested_next_url: null,
      started_at: stepStart,
    };
    results.push(running);
    onProgress({ step, result: running, totalSteps: playbook.steps.length, currentIndex: i, consolidated });

    let markdown = "";
    let cacheHit = false;

    // 4. cache pre-check
    const cached = await checkCache(url);
    if (cached) {
      markdown = cached.markdown;
      cacheHit = true;
    } else {
      // 5. scrape via extension
      const settleMs = step.settle_ms ?? 2500;
      const res = await extFs.readUrl(url, { settleMs, signal, skipCache: true });
      if (signal.aborted) break;
      if (!res.ok) {
        const failed: SherlockStepResult = {
          ...running,
          status: "error",
          error: res.error,
          duration_ms: Date.now() - stepStart,
        };
        results[results.length - 1] = failed;
        onProgress({ step, result: failed, totalSteps: playbook.steps.length, currentIndex: i, consolidated });
        continue;
      }
      markdown = extractMarkdown(res.data);
      if (markdown) {
        await persistScrape({ url, markdown, level: playbook.level, partnerId, contactId });
      }
    }

    if (!markdown) {
      const empty: SherlockStepResult = {
        ...running,
        status: "error",
        error: "Pagina vuota o non leggibile",
        duration_ms: Date.now() - stepStart,
        cache_hit: cacheHit,
      };
      results[results.length - 1] = empty;
      onProgress({ step, result: empty, totalSteps: playbook.steps.length, currentIndex: i, consolidated });
      continue;
    }

    // 6. AI extract
    const aiStart = Date.now();
    let aiFindings: Record<string, unknown> = {};
    let confidence: number | null = null;
    let suggestedNextUrl: string | null = null;
    let summaryText = "";
    try {
      const ai = await callExtractAI({
        markdown,
        step,
        targetFields: playbook.target_fields,
        priorFindings: consolidated,
        signal,
      });
      aiFindings = ai.findings;
      confidence = ai.confidence;
      suggestedNextUrl = ai.suggestedNextUrl;
      summaryText = ai.summary;
    } catch (e) {
      // AI failure: keep markdown but no findings
      console.warn("[sherlock] AI extract failed for step", step.order, e);
    }
    if (signal.aborted) break;

    // 7. consolida
    Object.entries(aiFindings).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") {
        consolidated[k] = v;
      }
    });

    // 8. var speciale per step successivi
    if (step.ai_decide_next && suggestedNextUrl) {
      // Heuristica: se URL contiene "linkedin.com/in/" → decision maker
      if (/linkedin\.com\/in\//i.test(suggestedNextUrl)) {
        liveVars.decisionMakerLinkedinUrl = suggestedNextUrl;
      }
    }

    const done: SherlockStepResult = {
      ...running,
      status: cacheHit ? "cached" : "done",
      markdown,
      findings: { ...aiFindings, _summary: summaryText },
      confidence,
      suggested_next_url: suggestedNextUrl,
      duration_ms: Date.now() - stepStart,
      ai_duration_ms: Date.now() - aiStart,
      cache_hit: cacheHit,
    };
    results[results.length - 1] = done;
    onProgress({ step, result: done, totalSteps: playbook.steps.length, currentIndex: i, consolidated: { ...consolidated } });
  }

  // Consolidamento finale: summary
  const summary = buildFinalSummary(consolidated, results);

  return {
    results,
    consolidated,
    summary,
    durationMs: Date.now() - startTs,
  };
}

function buildFinalSummary(consolidated: Record<string, unknown>, results: SherlockStepResult[]): string {
  const okCount = results.filter((r) => r.status === "done" || r.status === "cached").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;
  const fieldCount = Object.keys(consolidated).length;
  return [
    `Indagine completata: ${okCount} pagine OK, ${errCount} errori, ${skipCount} saltate.`,
    `Estratti ${fieldCount} campi unici.`,
  ].join(" ");
}
