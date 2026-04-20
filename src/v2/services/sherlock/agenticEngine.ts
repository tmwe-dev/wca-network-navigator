/**
 * agenticEngine — orchestratore "plan → fetch → observe → decide → repeat".
 *
 * Differenze rispetto a sherlockEngine.ts (playbook fisso):
 *  - Non ha step pre-cablati (/about, /team, ...).
 *  - L'AI decide cosa visitare, ciclo dopo ciclo, fino a esaurire il budget
 *    o decidere stop=true.
 *  - Filtra le pagine inutilizzabili (404, captcha, vuote) PRIMA di mostrarle
 *    e PRIMA di passarle all'AI di estrazione.
 *
 * Pipeline:
 *  1. Bootstrap: scarica home (se sito noto) + fa Google search del nome.
 *  2. Estrai link interni dall'home + risultati Google → "candidati".
 *  3. Loop:
 *      a) chiama agentic-decide → ottieni 1..3 azioni (URL+label) o stop.
 *      b) per ogni azione: scrape via extension, valuta qualità, AI extract.
 *      c) consolida findings, aggiungi nuovi link/google results ai candidati.
 *  4. Riassunto finale.
 */
import { fs as extFs } from "@/v2/io/extensions/bridge";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import {
  updatePartnerWebsiteIfMissing,
  updatePartnerLinkedinIfMissing,
} from "@/data/sherlockPlaybooks";
import { throttle } from "./rateLimiter";
import { assessPageQuality, reasonLabel } from "./pageQuality";
import type {
  SherlockLevel,
  SherlockStepResult,
  SherlockProgressEvent,
  SherlockChannel,
} from "./sherlockTypes";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Budget step per livello (numero massimo di pagine da scaricare oltre al bootstrap)
const BUDGET_BY_LEVEL: Record<SherlockLevel, number> = {
  1: 3,  // Scout — veloce
  2: 6,  // Detective — standard
  3: 10, // Sherlock — profondo
};

const TARGET_FIELDS_BY_LEVEL: Record<SherlockLevel, string[]> = {
  1: ["company_name", "main_services", "website", "address", "phone"],
  2: [
    "company_name", "main_services", "website", "address", "phone", "email",
    "ceo_or_owner", "founded_year", "team_size", "linkedin_url",
  ],
  3: [
    "company_name", "main_services", "website", "address", "phone", "email",
    "ceo_or_owner", "founded_year", "team_size", "linkedin_url",
    "decision_maker", "decision_maker_linkedin", "fleet_or_assets",
    "client_segments", "geographic_coverage", "recent_news", "reputation_signals",
  ],
};

const AGGREGATOR_DOMAINS = [
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "youtube.com", "wikipedia.org", "wikiwand.com", "yelp.com", "tripadvisor.",
  "pagine", "europages.", "kompass.", "yellowpages.", "bing.com", "duckduckgo.",
  "amazon.", "ebay.", "indeed.", "glassdoor.", "google.com/maps",
];

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

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    // rimuovi fragment e trailing slash
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

function isAggregator(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_DOMAINS.some((d) => host.includes(d));
  } catch {
    return true;
  }
}

/** Estrae link http(s) da un markdown, deduplica, normalizza. Esclude aggregatori. */
function extractInternalLinks(markdown: string, baseHost: string | null): string[] {
  if (!markdown) return [];
  const out = new Set<string>();
  // markdown links [text](url)
  const reMd = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  // bare urls
  const reBare = /https?:\/\/[^\s)<>"'\]]+/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = reMd.exec(markdown)) !== null) matches.push(m[2]);
  while ((m = reBare.exec(markdown)) !== null) matches.push(m[0]);
  for (const raw of matches) {
    const cleaned = raw.replace(/[)\].,;:!?]+$/, "");
    const norm = normalizeUrl(cleaned);
    if (!norm) continue;
    if (isAggregator(norm)) continue;
    if (baseHost) {
      try {
        const h = new URL(norm).hostname.toLowerCase();
        // mantieni solo same-host o sotto-domini dello stesso registrable
        if (!h.endsWith(baseHost) && !baseHost.endsWith(h)) continue;
      } catch {
        continue;
      }
    }
    out.add(norm);
  }
  return Array.from(out).slice(0, 80);
}

/** Estrae risultati da una SERP Google scrapata. */
function extractGoogleResults(markdown: string): { url: string; title: string; snippet: string }[] {
  if (!markdown) return [];
  const out: { url: string; title: string; snippet: string }[] = [];
  const reMd = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = reMd.exec(markdown)) !== null) {
    const title = m[1].trim();
    const url = m[2].replace(/[)\].,;:!?]+$/, "");
    if (!url.startsWith("http")) continue;
    if (/google\.com\/(?:search|sorry|preferences)/i.test(url)) continue;
    if (/webcache\.googleusercontent/.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    if (title.length < 4 || title.length > 200) continue;
    out.push({ url, title, snippet: "" });
    if (out.length >= 20) break;
  }
  return out;
}

async function checkCache(url: string): Promise<{ markdown: string } | null> {
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
    return { markdown: payload.markdown };
  } catch {
    return null;
  }
}

async function persistScrape(url: string, markdown: string, level: number): Promise<void> {
  try {
    await untypedFrom("scrape_cache").upsert({
      url,
      mode: "static",
      payload: { markdown, source: "sherlock-agentic", level, captured_at: new Date().toISOString() },
      scraped_at: new Date().toISOString(),
    });
  } catch {
    /* non-blocking */
  }
}

async function callExtractAI(args: {
  markdown: string;
  label: string;
  targetFields: string[];
  priorFindings: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<{
  findings: Record<string, unknown>;
  confidence: number;
  summary: string;
}> {
  const { data, error } = await supabase.functions.invoke("sherlock-extract", {
    body: {
      markdown: args.markdown,
      extract_prompt: `Estrai dalla pagina "${args.label}" tutto ciò che sia utile per scrivere
una mail commerciale a questa azienda. Dai priorità ai target_fields ma cattura anche
findings extra significativi (servizi, segmenti clienti, certificazioni, presenze geografiche,
notizie recenti). Ignora cookie banner, navigazione, footer.`,
      target_fields: args.targetFields,
      prior_findings: args.priorFindings,
      label: args.label,
    },
  });
  if (args.signal.aborted) throw new Error("Aborted");
  if (error) throw new Error(error.message ?? "AI extract failed");
  const d = (data ?? {}) as Record<string, unknown>;

  const fields = (d.fields as Record<string, unknown>) ?? {};
  const findings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined && v !== "") findings[k] = v;
  }
  const otherRaw = d.other_findings;
  if (Array.isArray(otherRaw)) {
    for (const item of otherRaw) {
      if (!item || typeof item !== "object") continue;
      const k = (item as { key?: unknown }).key;
      const v = (item as { value?: unknown }).value;
      if (typeof k === "string" && k && v !== null && v !== undefined && v !== "") {
        const safeKey = findings[k] === undefined ? k : `${k}_extra`;
        findings[safeKey] = v;
      }
    }
  }
  const summary = typeof d.summary === "string" ? d.summary : "";
  if (summary) findings._summary = summary;

  return {
    findings,
    confidence: typeof d.confidence === "number" ? d.confidence : 0,
    summary,
  };
}

interface AgenticAction {
  url: string;
  label: string;
  why: string;
}

async function callDecideAI(args: {
  companyName: string;
  city: string;
  country: string;
  website: string | null;
  budgetRemaining: number;
  visitedUrls: string[];
  candidateLinks: string[];
  googleResults: { url: string; title?: string; snippet?: string }[];
  findings: Record<string, unknown>;
  targetFields: string[];
  lastSummary: string;
  signal: AbortSignal;
}): Promise<{ stop: boolean; reason: string; next_actions: AgenticAction[] }> {
  const { data, error } = await supabase.functions.invoke("agentic-decide", {
    body: {
      company_name: args.companyName,
      city: args.city,
      country: args.country,
      website: args.website,
      budget_remaining: args.budgetRemaining,
      visited_urls: args.visitedUrls,
      candidate_links: args.candidateLinks,
      google_results: args.googleResults,
      findings_so_far: args.findings,
      target_fields: args.targetFields,
      last_page_summary: args.lastSummary,
    },
  });
  if (args.signal.aborted) throw new Error("Aborted");
  if (error) throw new Error(error.message ?? "Decide AI failed");
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    stop: Boolean(d.stop),
    reason: typeof d.reason === "string" ? d.reason : "",
    next_actions: Array.isArray(d.next_actions)
      ? (d.next_actions as AgenticAction[]).filter((a) => a && typeof a.url === "string")
      : [],
  };
}

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

interface ScrapeOutcome {
  ok: boolean;
  markdown: string;
  cacheHit: boolean;
  error?: string;
}

async function scrapeUrl(args: {
  url: string;
  channel: SherlockChannel;
  level: number;
  signal: AbortSignal;
}): Promise<ScrapeOutcome> {
  const cached = await checkCache(args.url);
  if (cached) return { ok: true, markdown: cached.markdown, cacheHit: true };
  try {
    await throttle(args.channel, args.url, args.signal);
  } catch {
    if (args.signal.aborted) return { ok: false, markdown: "", cacheHit: false, error: "Aborted" };
  }
  const res = await extFs.readUrl(args.url, { settleMs: 2500, signal: args.signal, skipCache: true });
  if (args.signal.aborted) return { ok: false, markdown: "", cacheHit: false, error: "Aborted" };
  if (!res.ok) return { ok: false, markdown: "", cacheHit: false, error: res.error };
  const md = extractMarkdown(res.data);
  if (md) await persistScrape(args.url, md, args.level);
  return { ok: true, markdown: md, cacheHit: false };
}

function makeStepResult(args: {
  order: number;
  label: string;
  url: string | null;
  channel?: SherlockChannel;
  startedAt: number;
}): SherlockStepResult {
  return {
    order: args.order,
    label: args.label,
    url: args.url,
    channel: args.channel ?? "generic",
    status: "running",
    markdown: "",
    findings: {},
    confidence: null,
    suggested_next_url: null,
    started_at: args.startedAt,
  };
}

function detectLinkedinCompanyUrl(markdown: string): string | null {
  if (!markdown) return null;
  const re = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[^\s)<>"'\]]+/i;
  const m = markdown.match(re);
  return m ? m[0].replace(/[)\].,;:!?]+$/, "") : null;
}

function buildFinalSummary(consolidated: Record<string, unknown>, results: SherlockStepResult[]): string {
  const ok = results.filter((r) => r.status === "done" || r.status === "cached").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;
  const fields = Object.keys(consolidated).filter((k) => !k.startsWith("_")).length;
  return [
    `Indagine completata: ${ok} pagine utili, ${skipped} ignorate, ${errors} errori.`,
    `Estratti ${fields} dati strutturati.`,
  ].join(" ");
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
  let candidateLinks: string[] = [];
  let googleResults: { url: string; title?: string; snippet?: string }[] = [];
  let lastSummary = "";
  let stepOrder = 0;
  let usedBudget = 0;

  const emit = (step: SherlockStepResult) => {
    const idx = results.findIndex((r) => r.order === step.order);
    if (idx >= 0) results[idx] = step;
    else results.push(step);
    onProgress({
      step: { order: step.order, label: step.label, url_template: step.url ?? "", required_vars: [], ai_extract_prompt: "" },
      result: step,
      totalSteps: budget + 2, // hint UI
      currentIndex: results.length - 1,
      consolidated: { ...consolidated },
    });
  };

  // ── BOOTSTRAP 1: scarica home (se conosciamo il sito)
  if (website) {
    stepOrder++;
    const startedAt = Date.now();
    const step = makeStepResult({ order: stepOrder, label: "Sito — Home", url: website, startedAt });
    emit(step);

    const out = await scrapeUrl({ url: website, channel: "generic", level, signal });
    visited.add(website);
    if (signal.aborted) return finishRun(results, consolidated, startTs);

    if (!out.ok) {
      emit({ ...step, status: "error", error: out.error ?? "Scrape fallito", duration_ms: Date.now() - startedAt });
    } else {
      const quality = assessPageQuality(out.markdown);
      if (!quality.usable) {
        emit({
          ...step,
          status: "skipped",
          markdown: "",
          error: reasonLabel(quality.reason) + " — " + quality.detail,
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
        });
      } else {
        // Estrai link interni e info LinkedIn dall'home
        let baseHost: string | null = null;
        try { baseHost = new URL(website).hostname.replace(/^www\./, ""); } catch { /* noop */ }
        candidateLinks = extractInternalLinks(out.markdown, baseHost);
        const liUrl = detectLinkedinCompanyUrl(out.markdown);
        if (liUrl && partnerId) {
          updatePartnerLinkedinIfMissing(partnerId, liUrl).catch(() => null);
          consolidated.linkedin_company_url = liUrl;
        }

        try {
          const ai = await callExtractAI({
            markdown: out.markdown,
            label: "Sito — Home",
            targetFields,
            priorFindings: consolidated,
            signal,
          });
          Object.entries(ai.findings).forEach(([k, v]) => {
            if (!k.startsWith("_") && v !== null && v !== undefined && v !== "") consolidated[k] = v;
          });
          lastSummary = ai.summary;
          emit({
            ...step,
            status: out.cacheHit ? "cached" : "done",
            markdown: out.markdown,
            findings: { ...ai.findings, _summary: ai.summary },
            confidence: ai.confidence,
            duration_ms: Date.now() - startedAt,
            cache_hit: out.cacheHit,
          });
        } catch (e) {
          emit({
            ...step,
            status: "done",
            markdown: out.markdown,
            duration_ms: Date.now() - startedAt,
            cache_hit: out.cacheHit,
            error: `AI extract: ${e instanceof Error ? e.message : "errore"}`,
          });
        }
      }
    }
  }

  // ── BOOTSTRAP 2: Google search del nome (per scoprire sito + reputation)
  if (companyName && !signal.aborted) {
    stepOrder++;
    const q = encodeURIComponent(`"${companyName}"${city ? ` ${city}` : ""}${country ? ` ${country}` : ""}`);
    const gUrl = `https://www.google.com/search?q=${q}`;
    const startedAt = Date.now();
    const step = makeStepResult({ order: stepOrder, label: `Google — "${companyName}"`, url: gUrl, startedAt });
    emit(step);

    const out = await scrapeUrl({ url: gUrl, channel: "generic", level, signal });
    visited.add(gUrl);
    if (signal.aborted) return finishRun(results, consolidated, startTs);

    if (!out.ok) {
      emit({ ...step, status: "error", error: out.error, duration_ms: Date.now() - startedAt });
    } else {
      const quality = assessPageQuality(out.markdown);
      if (!quality.usable) {
        emit({
          ...step, status: "skipped",
          error: reasonLabel(quality.reason) + " — " + quality.detail,
          duration_ms: Date.now() - startedAt, cache_hit: out.cacheHit,
        });
      } else {
        googleResults = extractGoogleResults(out.markdown);
        // Se non avevamo sito, prendi il primo risultato non aggregatore
        if (!website) {
          const candidate = googleResults.find((r) => !isAggregator(r.url))?.url;
          if (candidate) {
            const norm = normalizeUrl(candidate);
            if (norm) {
              try {
                const u = new URL(norm);
                website = `${u.protocol}//${u.hostname}`;
                consolidated.website = website;
                if (partnerId) updatePartnerWebsiteIfMissing(partnerId, website).catch(() => null);
              } catch { /* noop */ }
            }
          }
        }
        emit({
          ...step,
          status: out.cacheHit ? "cached" : "done",
          markdown: out.markdown,
          findings: { _summary: `${googleResults.length} risultati indicizzati per "${companyName}"` },
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
        });
        lastSummary = `Google ha restituito ${googleResults.length} risultati per "${companyName}".`;
      }
    }
  }

  // ── LOOP AGENTICO
  while (usedBudget < budget && !signal.aborted) {
    const remaining = budget - usedBudget;
    let decision: { stop: boolean; reason: string; next_actions: AgenticAction[] };
    try {
      decision = await callDecideAI({
        companyName, city, country, website,
        budgetRemaining: remaining,
        visitedUrls: Array.from(visited),
        candidateLinks: candidateLinks.filter((u) => !visited.has(u)),
        googleResults: googleResults.filter((r) => !visited.has(r.url)),
        findings: consolidated,
        targetFields,
        lastSummary,
        signal,
      });
    } catch (e) {
      console.warn("[agentic] decide failed", e);
      break;
    }

    if (decision.stop || decision.next_actions.length === 0) {
      consolidated._stop_reason = decision.reason || "AI ha deciso di fermarsi";
      break;
    }

    for (const action of decision.next_actions) {
      if (usedBudget >= budget || signal.aborted) break;
      const norm = normalizeUrl(action.url);
      if (!norm || visited.has(norm)) continue;
      visited.add(norm);
      usedBudget++;
      stepOrder++;

      const channel: SherlockChannel = /linkedin\.com/i.test(norm) ? "linkedin" : "generic";
      const startedAt = Date.now();
      const step = makeStepResult({ order: stepOrder, label: action.label || norm, url: norm, channel, startedAt });
      emit(step);

      const out = await scrapeUrl({ url: norm, channel, level, signal });
      if (signal.aborted) break;

      if (!out.ok) {
        emit({ ...step, status: "error", error: out.error, duration_ms: Date.now() - startedAt });
        continue;
      }

      const quality = assessPageQuality(out.markdown);
      if (!quality.usable) {
        emit({
          ...step,
          status: "skipped",
          markdown: "",
          error: reasonLabel(quality.reason),
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
        });
        continue;
      }

      // Aggiorna candidati con eventuali nuovi link emersi
      try {
        const baseHost = website ? new URL(website).hostname.replace(/^www\./, "") : null;
        const newLinks = extractInternalLinks(out.markdown, baseHost);
        for (const l of newLinks) {
          if (!visited.has(l) && !candidateLinks.includes(l)) candidateLinks.push(l);
        }
        if (candidateLinks.length > 120) candidateLinks = candidateLinks.slice(-120);
      } catch { /* noop */ }

      try {
        const ai = await callExtractAI({
          markdown: out.markdown,
          label: action.label || norm,
          targetFields,
          priorFindings: consolidated,
          signal,
        });
        Object.entries(ai.findings).forEach(([k, v]) => {
          if (!k.startsWith("_") && v !== null && v !== undefined && v !== "") consolidated[k] = v;
        });
        lastSummary = ai.summary || lastSummary;
        emit({
          ...step,
          status: out.cacheHit ? "cached" : "done",
          markdown: out.markdown,
          findings: { ...ai.findings, _summary: ai.summary, _why: action.why },
          confidence: ai.confidence,
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
        });
      } catch (e) {
        emit({
          ...step,
          status: "done",
          markdown: out.markdown,
          duration_ms: Date.now() - startedAt,
          cache_hit: out.cacheHit,
          error: `AI extract: ${e instanceof Error ? e.message : "errore"}`,
        });
      }
    }
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
