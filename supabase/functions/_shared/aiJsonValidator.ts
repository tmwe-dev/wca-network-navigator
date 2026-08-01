/**
 * aiJsonValidator.ts — schema validation (Zod) per output JSON dei flussi AI.
 *
 * Obiettivi:
 *  - Centralizzare il parsing JSON di risposte modello (anche con fences markdown).
 *  - Validare la struttura con uno schema Zod -> tipi sicuri.
 *  - Fallback deterministico in caso di parse o validation error (mai throw verso il caller).
 *  - Logging strutturato del fallimento (function name, model, raw preview, issue path).
 *
 * Uso tipico in una edge function:
 *
 *   import { z } from "https://esm.sh/zod@3.23.8";
 *   import { safeParseAiJson } from "../_shared/aiJsonValidator.ts";
 *
 *   const Schema = z.object({ category: z.string(), confidence: z.number() });
 *   const result = safeParseAiJson(rawText, Schema, {
 *     fnName: "categorize-content",
 *     model: "google/gemini-2.5-flash",
 *     fallback: { category: "uncategorized", confidence: 0.1 },
 *   });
 *   // result.data sempre valorizzato; result.isFallback indica se è stato usato fallback.
 */

import { z, type ZodTypeAny } from "https://esm.sh/zod@3.23.8";
import { stripMarkdownFences } from "./responseParserFactory.ts";

export interface SafeParseAiJsonOptions<T> {
  fnName: string;
  model?: string;
  fallback: T;
  /** Se true (default), prova anche a estrarre il primo blocco {...} dal testo. */
  extractFirstObject?: boolean;
  /** Lunghezza max del raw loggato in caso di errore (default 300). */
  rawPreviewLen?: number;
}

export interface SafeParseAiJsonResult<T> {
  data: T;
  isFallback: boolean;
  error?: string;
}

/** Estrae il primo blocco JSON `{...}` o `[...]` da un testo libero. */
function extractJsonBlock(text: string): string | null {
  if (!text) return null;
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  return null;
}

/**
 * Parse + validate sicuro di una stringa JSON proveniente da un modello AI.
 * Garantisce sempre il ritorno di un oggetto conforme a `T` (fallback se necessario).
 */
export function safeParseAiJson<S extends ZodTypeAny>(
  raw: string | null | undefined,
  schema: S,
  opts: SafeParseAiJsonOptions<z.infer<S>>,
): SafeParseAiJsonResult<z.infer<S>> {
  const fn = opts.fnName;
  const model = opts.model ?? "unknown";
  const previewLen = opts.rawPreviewLen ?? 300;

  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    console.error(`[AI_JSON_VALIDATION] fn=${fn} model=${model} err=empty_response`);
    return { data: opts.fallback, isFallback: true, error: "empty_response" };
  }

  const cleaned = stripMarkdownFences(raw);
  const candidates: string[] = [cleaned];
  if (opts.extractFirstObject !== false) {
    const block = extractJsonBlock(cleaned);
    if (block && block !== cleaned) candidates.push(block);
  }

  let parsed: unknown = undefined;
  let lastParseErr = "";
  for (const c of candidates) {
    try {
      parsed = JSON.parse(c);
      lastParseErr = "";
      break;
    } catch (err) {
      lastParseErr = err instanceof Error ? err.message : String(err);
    }
  }

  if (parsed === undefined) {
    console.error(
      `[AI_JSON_VALIDATION] fn=${fn} model=${model} err=parse_error msg=${lastParseErr} raw="${raw.slice(0, previewLen)}"`,
    );
    return { data: opts.fallback, isFallback: true, error: `parse_error:${lastParseErr}` };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}:${i.code}:${i.message}`)
      .join("|");
    console.error(
      `[AI_JSON_VALIDATION] fn=${fn} model=${model} err=schema_error issues=${issues} raw="${raw.slice(0, previewLen)}"`,
    );
    return { data: opts.fallback, isFallback: true, error: `schema_error:${issues}` };
  }

  return { data: result.data as z.infer<S>, isFallback: false };
}

/**
 * Variante per parsare gli `arguments` JSON di una tool-call OpenAI/Gemini.
 * Gli `arguments` arrivano già come stringa JSON serializzata: niente fences attesi,
 * ma il modello a volte produce JSON malformato → fallback safe.
 */
export function safeParseToolArgs<S extends ZodTypeAny>(
  argsRaw: string | null | undefined,
  schema: S,
  opts: SafeParseAiJsonOptions<z.infer<S>>,
): SafeParseAiJsonResult<z.infer<S>> {
  return safeParseAiJson(argsRaw, schema, { ...opts, extractFirstObject: false });
}

export { z };