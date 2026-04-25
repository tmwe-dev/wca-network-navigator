/**
 * AI function calls — extract and decide.
 */
import { supabase } from "@/integrations/supabase/client";

const MAX_MARKDOWN_CHARS = 8_000;
const MAX_PRIOR_FINDINGS_CHARS = 2_000;

/**
 * Tronca il markdown di una pagina scraped a max 8K chars,
 * privilegiando i paragrafi che contengono keyword dei target_fields.
 * Riduce drasticamente i token per call AI senza perdere le info utili.
 */
export function truncateMarkdownSmart(markdown: string, targetFields: string[]): string {
  if (!markdown || markdown.length <= MAX_MARKDOWN_CHARS) return markdown;

  const keywords = (targetFields || [])
    .flatMap((f) => f.toLowerCase().split(/[\s_\-]+/))
    .filter((w) => w.length > 3);

  const paragraphs = markdown.split(/\n{2,}/);
  const scored = paragraphs.map((p) => ({
    text: p,
    score: keywords.reduce(
      (acc, kw) => acc + (p.toLowerCase().includes(kw) ? 1 : 0),
      0,
    ),
  }));
  // Ordine: rilevanza desc, poi ordine originale per i pari merito
  const indexed = scored.map((s, i) => ({ ...s, i }));
  indexed.sort((a, b) => (b.score - a.score) || (a.i - b.i));

  let out = "";
  for (const { text } of indexed) {
    if (out.length + text.length + 2 > MAX_MARKDOWN_CHARS) break;
    out += text + "\n\n";
  }
  return out.trim() || markdown.slice(0, MAX_MARKDOWN_CHARS);
}

/**
 * Compatta i prior_findings accumulati tra step in una lista compatta di
 * fatti chiave (max 2K chars), in modo che la chain di step Sherlock non
 * cresca quadratica in token.
 */
export function compactFindings(findings: Record<string, unknown>): string {
  if (!findings || typeof findings !== "object") return "";
  const lines: string[] = [];
  for (const [k, v] of Object.entries(findings)) {
    if (k.startsWith("_")) continue; // skip metadata interni (_summary, _confidence)
    if (v === null || v === undefined || v === "") continue;
    const str = typeof v === "string" ? v : JSON.stringify(v);
    lines.push(`${k}: ${str.slice(0, 150)}`);
  }
  const text = lines.join("\n");
  if (text.length <= MAX_PRIOR_FINDINGS_CHARS) return text;
  return text.slice(0, MAX_PRIOR_FINDINGS_CHARS) + "\n[...altri findings troncati]";
}

export interface ExtractResult {
  findings: Record<string, unknown>;
  confidence: number;
  summary: string;
}

export interface AgenticAction {
  url: string;
  label: string;
  why: string;
}

export interface DecideResult {
  stop: boolean;
  reason: string;
  next_actions: AgenticAction[];
}

export async function callExtractAI(args: {
  markdown: string;
  label: string;
  targetFields: string[];
  priorFindings: Record<string, unknown>;
  signal: AbortSignal;
}): Promise<ExtractResult> {
  const safeMarkdown = truncateMarkdownSmart(args.markdown, args.targetFields);
  const compactPrior = compactFindings(args.priorFindings);
  const { data, error } = await supabase.functions.invoke("sherlock-extract", {
    body: {
      markdown: safeMarkdown,
      extract_prompt: `Estrai dalla pagina "${args.label}" tutto ciò che sia utile per scrivere
una mail commerciale a questa azienda. Dai priorità ai target_fields ma cattura anche
findings extra significativi (servizi, segmenti clienti, certificazioni, presenze geografiche,
notizie recenti). Ignora cookie banner, navigazione, footer.`,
      target_fields: args.targetFields,
      prior_findings: compactPrior,
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

export async function callDecideAI(args: {
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
}): Promise<DecideResult> {
  const compactFindingsText = compactFindings(args.findings);
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
      findings_so_far: compactFindingsText,
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
