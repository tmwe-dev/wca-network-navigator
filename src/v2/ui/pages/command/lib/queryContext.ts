/**
 * queryContext — Structured conversational context for follow-up queries.
 *
 * Persists the last successful query "shape" so elliptical follow-ups
 * like "e a New York?" can inherit table + compatible filters.
 */
import type { QueryPlan, QueryFilter } from "./safeQueryExecutor";

export interface QueryContext {
  /** Last queried table */
  readonly table: string;
  /** Last filters applied */
  readonly filters: readonly QueryFilter[];
  /** Whether the last query was a count vs. a list */
  readonly mode: "count" | "list";
  /** Timestamp (ms) — context expires after 5 minutes of inactivity */
  readonly ts: number;
}

const CONTEXT_TTL_MS = 5 * 60_000;

export function buildContextFromPlan(plan: QueryPlan): QueryContext {
  // count-mode heuristic: only id selected OR title contains conteggio/quanti
  const isCount =
    (plan.columns?.length === 1 && plan.columns[0] === "id") ||
    /\b(conteggio|quanti|quante|totale|count)\b/i.test(plan.title ?? "") ||
    /\b(conteggio|quanti|quante|count)\b/i.test(plan.rationale ?? "");
  return {
    table: plan.table,
    filters: plan.filters,
    mode: isCount ? "count" : "list",
    ts: Date.now(),
  };
}

export function isContextFresh(ctx: QueryContext | null): boolean {
  if (!ctx) return false;
  return Date.now() - ctx.ts < CONTEXT_TTL_MS;
}

/**
 * Heuristic: detect if a prompt is an ELLIPTICAL follow-up
 * (very short, contains "e a", "anche", just a city/country, etc.)
 */
export function isElliptical(prompt: string): boolean {
  const trimmed = prompt.trim().toLowerCase();
  if (trimmed.length === 0) return false;
  // Very short queries without verbs
  const hasVerb = /\b(mostra|cerca|trova|elenc|visualiz|lista|quanti|quante|dammi|fammi)\b/.test(trimmed);
  if (hasVerb) return false;
  // Starts with "e a", "e in", "anche", "solo a", "a "
  if (/^(e\s+a\s+|e\s+in\s+|anche\s+|solo\s+a\s+|a\s+)/i.test(trimmed)) return true;
  if (/^(e\s+|invece\s+|adesso\s+)/i.test(trimmed) && trimmed.length < 40) return true;
  // Just a place name (1-3 words, no verb)
  if (trimmed.split(/\s+/).length <= 3) return true;
  return false;
}

/**
 * Serialize context to a hint string for the planner prompt.
 * The planner edge fn will use this to inherit compatible filters.
 */
export function contextHint(ctx: QueryContext | null): string {
  if (!ctx || !isContextFresh(ctx)) return "";
  const filterDesc = ctx.filters
    .map((f) => `${f.column} ${f.op} ${JSON.stringify(f.value)}`)
    .join(" AND ");
  return `\n\nCONTESTO TURNO PRECEDENTE: tabella=${ctx.table}, mode=${ctx.mode}, filtri=[${filterDesc || "nessuno"}]. Se il nuovo prompt è un follow-up ellittico (es. "e a New York?", "anche a Miami"), EREDITA tabella e filtri compatibili dal contesto, SOSTITUENDO solo quelli esplicitamente cambiati (es. cambia/aggiunge "city").`;
}
