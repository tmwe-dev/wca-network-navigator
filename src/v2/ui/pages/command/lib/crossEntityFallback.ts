/**
 * crossEntityFallback — Rete di sicurezza per le query a zero risultati.
 *
 * Quando il QueryPlan non trova nulla (tabella/campo sbagliati, valore scritto
 * in forma diversa), interroghiamo la RPC `ai_find_anything` che cerca lo
 * stesso testo su partner, contatti partner, contatti importati, biglietti da
 * visita, prospect e contatti prospect, senza dover conoscere il campo esatto.
 *
 * Restituisce dati pronti per un ToolResult di tipo tabella.
 */
import { rpcFindAnything } from "@/data/aiFindAnything";
import type { QueryFilter } from "./safeQueryExecutor";

export interface CrossEntityMatch {
  readonly id: string;
  readonly source: string;
  readonly label: string;
  readonly matched_on: string;
  readonly detail: Record<string, unknown>;
}

export interface CrossEntityResult {
  readonly term: string;
  readonly matches: readonly CrossEntityMatch[];
  readonly partial: boolean;
}

const STOP_TERMS = new Set(["true", "false", "null", "%", ""]);

/** Estrae il termine testuale più significativo dai filtri del piano. */
export function extractSearchTerm(filters: readonly QueryFilter[], fallbackPrompt: string): string | null {
  const candidates: string[] = [];
  for (const f of filters) {
    const v = f.value;
    if (typeof v !== "string") continue;
    const clean = v.replace(/%/g, "").trim();
    if (clean.length >= 2 && !STOP_TERMS.has(clean.toLowerCase())) candidates.push(clean);
  }
  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }
  // Fallback: nome proprio nel prompt (parola capitalizzata non iniziale di frase)
  const tokens = fallbackPrompt.trim().split(/\s+/).slice(1);
  const proper = tokens.find((t) => /^[A-ZÀ-Ý][\p{L}'’.-]{2,}$/u.test(t));
  return proper ? proper.replace(/[.,;:]$/, "") : null;
}

/** Cerca il termine su tutte le entità principali. */
export async function findAnything(term: string, limit = 10): Promise<CrossEntityResult | null> {
  const cleaned = term.trim();
  if (cleaned.length < 2) return null;
  try {
    const payload = await rpcFindAnything(cleaned, limit);
    if (!payload) return null;
    const matches = Array.isArray(payload.results) ? (payload.results as CrossEntityMatch[]) : [];
    if (matches.length === 0) return null;
    return { term: cleaned, matches, partial: Boolean(payload.partial) };
  } catch {
    return null;
  }
}

/** Riduce il dettaglio a una stringa leggibile per la tabella dei risultati. */
export function summarizeDetail(detail: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v == null || v === "") continue;
    if (k.endsWith("_id")) continue;
    parts.push(`${k}: ${String(v)}`);
  }
  return parts.slice(0, 4).join(" · ") || "—";
}
