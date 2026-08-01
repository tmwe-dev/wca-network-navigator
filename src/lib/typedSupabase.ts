/**
 * Confine UNICO di accesso a tabelle il cui nome non è noto staticamente.
 *
 * Serve esclusivamente ai piani di query generati a runtime dal planner AI
 * (`src/data/validatedQuery.ts`): il nome della tabella arriva da una
 * whitelist runtime, quindi i tipi generati non sono applicabili.
 *
 * A differenza della versione precedente questo modulo NON espone `any`:
 * il builder è descritto da un contratto strutturale minimo e i risultati
 * sono `unknown`, da validare dal chiamante. L'unico cast del repository
 * (`as unknown as`) è confinato qui ed è la frontiera irriducibile
 * documentata: PostgREST non può essere tipizzato su un nome dinamico.
 *
 * Regole:
 * - nessun altro modulo può replicare il cast;
 * - i chiamanti validano tabella/colonne/operatori contro una whitelist;
 * - una tabella nota ai tipi generati va usata con `supabase.from(...)`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RuntimeQueryError {
  readonly message: string;
  readonly code?: string;
}

export interface RuntimeQueryResult {
  readonly data: unknown;
  readonly error: RuntimeQueryError | null;
  readonly count?: number | null;
}

/** Filtri/modificatori ammessi su una query dinamica. */
export interface RuntimeQuery extends PromiseLike<RuntimeQueryResult> {
  eq(column: string, value: unknown): RuntimeQuery;
  neq(column: string, value: unknown): RuntimeQuery;
  ilike(column: string, pattern: string): RuntimeQuery;
  in(column: string, values: readonly unknown[]): RuntimeQuery;
  is(column: string, value: unknown): RuntimeQuery;
  gt(column: string, value: unknown): RuntimeQuery;
  gte(column: string, value: unknown): RuntimeQuery;
  lt(column: string, value: unknown): RuntimeQuery;
  lte(column: string, value: unknown): RuntimeQuery;
  or(filter: string): RuntimeQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): RuntimeQuery;
  range(from: number, to: number): RuntimeQuery;
  limit(n: number): RuntimeQuery;
  maybeSingle(): PromiseLike<RuntimeQueryResult>;
  single(): PromiseLike<RuntimeQueryResult>;
}

export interface RuntimeTable {
  select(columns: string, options?: { count?: "exact" }): RuntimeQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): RuntimeQuery;
  update(values: Record<string, unknown>): RuntimeQuery;
  delete(): RuntimeQuery;
}

/**
 * Lista esplicita delle tabelle raggiungibili solo per nome runtime.
 * Documentazione del perimetro: `tFrom` accetta comunque `string` perché il
 * planner può proporre qualsiasi nome e la validazione è del chiamante.
 */
export const KNOWN_UNTYPED_TABLES = [
  "deals",
  "deal_activities",
  "supervisor_audit_log",
  "email_prompts",
  "operative_prompts",
  "commercial_playbooks",
  "app_settings",
] as const;

export type KnownUntypedTable = (typeof KNOWN_UNTYPED_TABLES)[number];

/** Client ristretto: `from` su nome dinamico, risultati `unknown`. */
const runtimeClient = supabase as unknown as { from(table: string): RuntimeTable };

/** Unico accesso dinamico del repository. Nessun `any` nella firma pubblica. */
export function tFrom(table: KnownUntypedTable | string): RuntimeTable {
  return runtimeClient.from(table);
}
