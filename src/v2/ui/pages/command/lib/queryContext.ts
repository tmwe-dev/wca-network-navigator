/**
 * queryContext — Structured conversational context for follow-up queries.
 *
 * Persists the last successful query "shape" so elliptical follow-ups
 * like "e a New York?" can inherit table + compatible filters.
 */
import type { QueryPlan, QueryFilter } from "./safeQueryExecutor";
import { isSynthesisIntent } from "./intentDetector";

export interface QueryContext {
  /** Last queried table */
  readonly table: string;
  /** Last filters applied */
  readonly filters: readonly QueryFilter[];
  /** Whether the last query was a count vs. a list */
  readonly mode: "count" | "list";
  /** Timestamp (ms) — context expires after 5 minutes of inactivity */
  readonly ts: number;
  /** Snapshot of the rows returned at the previous turn (max 20, capped JSON ≤ 8KB).
   *  Used by the synthesis branch to reuse data without re-querying the DB. */
  readonly lastResultRows?: ReadonlyArray<Record<string, unknown>>;
  /** Title shown in the canvas at the previous turn (for the synthesis prompt). */
  readonly lastResultTitle?: string;
}

const CONTEXT_TTL_MS = 5 * 60_000;
const SNAPSHOT_MAX_ROWS = 20;
const SNAPSHOT_MAX_BYTES = 8 * 1024;

/** Truncate rows so the JSON payload stays under SNAPSHOT_MAX_BYTES. */
function capRowsForSnapshot(
  rows: ReadonlyArray<Record<string, unknown>>,
): ReadonlyArray<Record<string, unknown>> {
  const limited = rows.slice(0, SNAPSHOT_MAX_ROWS);
  // Greedy shrink: drop the tail until we fit the byte budget.
  let kept = limited.slice();
  while (kept.length > 0 && JSON.stringify(kept).length > SNAPSHOT_MAX_BYTES) {
    kept = kept.slice(0, -1);
  }
  return kept;
}

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

/** Same as buildContextFromPlan but also persists a row snapshot for synthesis follow-ups. */
export function buildContextWithRows(
  plan: QueryPlan,
  rows: ReadonlyArray<Record<string, unknown>>,
  title?: string,
): QueryContext {
  const base = buildContextFromPlan(plan);
  return {
    ...base,
    lastResultRows: capRowsForSnapshot(rows),
    lastResultTitle: title,
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
  // Very short queries without verbs (read OR write).
  // Includiamo anche i verbi di scrittura/azione perché un follow-up come
  // "scrivi una mail a tutti quanti" NON è ellittico per il fast-lane di
  // ai-query: è un comando di compose-email che ha solo bisogno di
  // ereditare il country dalla query precedente.
  const hasReadVerb = /\b(mostra|cerca|trova|elenc|visualiz|lista|quanti|quante|dammi|fammi)\b/.test(trimmed);
  const hasWriteVerb = /\b(scriv|componi|prepara|manda|invia|genera|crea|aggiorna|modifica|aggiungi|rimuovi|cancella|elimina|esegui|lancia|avvia)\b/.test(trimmed);
  if (hasReadVerb || hasWriteVerb) return false;
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
 *
 * If `currentPrompt` is provided and the user intent has CHANGED (synthesis,
 * different domain noun), the hint is suppressed to avoid hyper-restrictive
 * filter inheritance.
 */
export function contextHint(ctx: QueryContext | null, currentPrompt?: string): string {
  if (!ctx || !isContextFresh(ctx)) return "";
  if (currentPrompt && shouldSuppressInheritance(ctx, currentPrompt)) return "";
  const filterDesc = ctx.filters
    .map((f) => `${f.column} ${f.op} ${JSON.stringify(f.value)}`)
    .join(" AND ");
  return `\n\nCONTESTO TURNO PRECEDENTE: tabella=${ctx.table}, mode=${ctx.mode}, filtri=[${filterDesc || "nessuno"}]. Se il nuovo prompt è un follow-up ellittico (es. "e a New York?", "anche a Miami"), EREDITA tabella e filtri compatibili dal contesto, SOSTITUENDO solo quelli esplicitamente cambiati (es. cambia/aggiunge "city").`;
}

/** Decide whether the previous turn's filters should NOT be inherited. */
function shouldSuppressInheritance(ctx: QueryContext, prompt: string): boolean {
  // 1. Synthesis intent → never inherit filters (no DB query expected).
  if (isSynthesisIntent(prompt)) return true;
  // 2. Domain mismatch: prompt mentions a different domain noun.
  const domainOfPrompt = detectDomainNoun(prompt);
  if (domainOfPrompt && !isSameDomain(ctx.table, domainOfPrompt)) return true;
  return false;
}

function detectDomainNoun(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  if (/\bpartner/.test(lower)) return "partners";
  if (/\bcontatt/.test(lower)) return "imported_contacts";
  if (/\battivit/.test(lower)) return "activities";
  if (/\boutreach\b/.test(lower)) return "outreach_queue";
  if (/\bcampagn/.test(lower)) return "campaign_jobs";
  if (/\bbiglietti?\b/.test(lower)) return "business_cards";
  if (/\bagent[ie]\b/.test(lower)) return "agents";
  if (/\b(kb|knowledge\s*base|voci\s+kb)\b/.test(lower)) return "kb_entries";
  return null;
}

function isSameDomain(table: string, domain: string): boolean {
  return table === domain;
}
