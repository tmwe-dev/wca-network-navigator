/**
 * responseParserFactory.ts — utility condivise per parsing robusto risposte AI.
 *
 * Tutte le funzioni che parsano output AI dovrebbero usare questi helper:
 * - try/catch garantito
 * - log strutturato del fallimento (function name, model, raw preview)
 * - fallback valido (mai null/undefined)
 */

const VALID_CLASSIFICATION_CATEGORIES = [
  "interested",
  "not_interested",
  "request_info",
  "meeting_request",
  "complaint",
  "follow_up",
  "auto_reply",
  "spam",
  "uncategorized",
  "question",
  "unsubscribe",
  "bounce",
] as const;

const VALID_SENTIMENTS = ["positive", "neutral", "negative", "mixed"] as const;

export interface ParseEmailFallbackOptions {
  fallbackSubject?: string;
}

export interface ParsedEmailFromAi {
  subject: string;
  body: string;
  isFallback: boolean;
}

export interface ParsedClassification {
  category: string;
  confidence: number;
  sentiment: string;
  isFallback: boolean;
  raw?: Record<string, unknown>;
}

/** Rimuove eventuali fences markdown ```json ... ``` o ``` ... ``` */
export function stripMarkdownFences(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  return cleaned;
}

/** Tronca testo + rimuove tag pericolosi per fallback sicuro */
export function sanitizeForFallback(text: string, maxLen = 5000): string {
  if (!text) return "";
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .slice(0, maxLen)
    .trim();
}

/**
 * Wrapper sicuro per estrazione subject/body da risposta AI.
 * Usa il parser esterno passato; in caso di crash → fallback safe.
 */
export function safeParseEmailResponse(
  raw: string,
  fnName: string,
  model: string,
  parser: (raw: string) => { subject: string; body: string },
  opts: ParseEmailFallbackOptions = {},
): ParsedEmailFromAi {
  try {
    const result = parser(raw);
    if (!result.body || result.body.trim().length === 0) {
      throw new Error("empty body after parse");
    }
    return { subject: result.subject || (opts.fallbackSubject ?? "Follow-up"), body: result.body, isFallback: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PARSE_FAIL] ${fnName} model=${model} err=${msg} raw="${(raw || "").slice(0, 200)}"`);
    return {
      subject: opts.fallbackSubject ?? "Follow-up",
      body: sanitizeForFallback(raw),
      isFallback: true,
    };
  }
}

/**
 * Parser robusto per classificazione AI.
 * Rimuove fences, JSON.parse, valida enum, clamp confidence.
 * Se fallisce → fallback uncategorized/0.1/neutral con log.
 */
export function parseClassification(
  raw: string | null | undefined,
  fnName: string,
  model: string,
): ParsedClassification {
  if (!raw) {
    console.error(`[PARSE_FAIL] ${fnName} model=${model} err=empty_response`);
    return { category: "uncategorized", confidence: 0.1, sentiment: "neutral", isFallback: true };
  }
  try {
    const cleaned = stripMarkdownFences(raw);
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const cat = String(parsed.category ?? "");
    const conf = Number(parsed.confidence ?? 0);
    const sent = String(parsed.sentiment ?? "neutral");
    return {
      category: (VALID_CLASSIFICATION_CATEGORIES as readonly string[]).includes(cat) ? cat : "uncategorized",
      confidence: Math.max(0, Math.min(1, isFinite(conf) ? conf : 0.1)),
      sentiment: (VALID_SENTIMENTS as readonly string[]).includes(sent) ? sent : "neutral",
      isFallback: false,
      raw: parsed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PARSE_FAIL] ${fnName} model=${model} err=${msg} raw="${raw.slice(0, 200)}"`);
    return { category: "uncategorized", confidence: 0.1, sentiment: "neutral", isFallback: true };
  }
}