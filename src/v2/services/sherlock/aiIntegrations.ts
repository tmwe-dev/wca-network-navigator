/**
 * AI function calls — extract and decide.
 */
import { supabase } from "@/integrations/supabase/client";

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
