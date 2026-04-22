/**
 * Scraping operations and result building.
 */
import { fs as extFs } from "@/v2/io/extensions/bridge";
import { checkCache, persistScrape } from "./cacheManager";
import { extractMarkdown } from "./markdownExtraction";
import type { SherlockChannel, SherlockStepResult } from "./sherlockTypes";

export interface ScrapeOutcome {
  ok: boolean;
  markdown: string;
  cacheHit: boolean;
  error?: string;
}

export async function scrapeUrl(args: {
  url: string;
  channel: SherlockChannel;
  level: number;
  signal: AbortSignal;
  throttle?: (channel: SherlockChannel, url: string, signal: AbortSignal) => Promise<void>;
}): Promise<ScrapeOutcome> {
  // Check cache first
  const cached = await checkCache(args.url);
  if (cached) return { ok: true, markdown: cached.markdown, cacheHit: true };

  // Rate limiting
  if (args.throttle) {
    try {
      await args.throttle(args.channel, args.url, args.signal);
    } catch {
      if (args.signal.aborted) return { ok: false, markdown: "", cacheHit: false, error: "Aborted" };
    }
  }

  // Fetch content
  const res = await extFs.readUrl(args.url, { settleMs: 2500, signal: args.signal, skipCache: true });
  if (args.signal.aborted) return { ok: false, markdown: "", cacheHit: false, error: "Aborted" };
  if (!res.ok) return { ok: false, markdown: "", cacheHit: false, error: res.error };

  // Extract markdown
  const md = extractMarkdown(res.data);
  if (md) await persistScrape(args.url, md, args.level);

  return { ok: true, markdown: md, cacheHit: false };
}

export function makeStepResult(args: {
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

export function buildFinalSummary(
  consolidated: Record<string, unknown>,
  results: SherlockStepResult[],
): string {
  const ok = results.filter((r) => r.status === "done" || r.status === "cached").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;
  const fields = Object.keys(consolidated).filter((k) => !k.startsWith("_")).length;

  return [
    `Indagine completata: ${ok} pagine utili, ${skipped} ignorate, ${errors} errori.`,
    `Estratti ${fields} dati strutturati.`,
  ].join(" ");
}
