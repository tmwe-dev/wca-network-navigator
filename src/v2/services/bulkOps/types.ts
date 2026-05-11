/**
 * Tipi pubblici di bulkOps — SSOT operazioni massive.
 */

export type BulkScope =
  // Blocco 1 — Arricchimento base
  | "enrich.base"
  // Blocco 2 — Deep Search (Sherlock 3 livelli)
  | "deepsearch.sherlock"
  // Blocco 3 — Download partner (WCA / scrape)
  | "download.partner"
  // Blocco 4 — Inbound enrichment (Funnemail)
  | "enrich.inbound"
  // Blocco 5 — Verifiche bulk
  | "verify.wa"
  | "verify.li"
  | "verify.email"
  | "verify.dedup"
  // Blocco 6 — Update bulk
  | "update.origin"
  | "update.leadStatus"
  | "update.emailRules"
  | "update.backfill"
  | "update.analyzeAi"
  | "update.dispatch";

export interface BulkRunOptions {
  readonly sourceView?: string;
  readonly concurrency?: number;
  readonly payload?: Record<string, unknown>;
  readonly onProgress?: (processed: number, total: number) => void;
}

export interface BulkItemResult<R = unknown> {
  readonly itemId: string;
  readonly ok: boolean;
  readonly value?: R;
  readonly error?: string;
}

export interface BulkRunResult<R = unknown> {
  readonly jobId: string;
  readonly scope: BulkScope;
  readonly total: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly results: ReadonlyArray<BulkItemResult<R>>;
}

/**
 * Handler interno per uno scope. Riceve l'item, ritorna un risultato.
 * Il runner si occupa di concorrenza, retry, log, persistenza.
 */
export type BulkEntryHandler<I = unknown, R = unknown> = (
  item: I,
  ctx: { jobId: string; userId: string; payload: Record<string, unknown> },
) => Promise<R>;

export interface BulkEntry<I = unknown, R = unknown> {
  readonly scope: BulkScope;
  readonly handler: BulkEntryHandler<I, R>;
  /** Estrae un id stringa da un item per logging/dedup. */
  readonly itemId: (item: I) => string;
  /** True per scope che NON devono fallire l'intero job per singolo errore. */
  readonly continueOnError?: boolean;
}