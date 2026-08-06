/**
 * Interfaccia minima strutturale del client Supabase usata dai guard cron.
 *
 * Il tipo reale `SupabaseClient` ha generici troppo profondi per un confronto
 * strutturale completo (TS2589), quindi il confine è `from(table) => unknown`
 * e il chain viene ristretto con type guard runtime (nessun cast, nessun `any`).
 */

export interface CronSelectBuilder {
  eq(column: string, value: string): CronSelectBuilder;
  is(column: string, value: null): CronSelectBuilder;
  order(column: string, options: { ascending: boolean }): CronSelectBuilder;
  limit(count: number): CronSelectBuilder;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null }>;
}

export interface CronTableBuilder {
  select(columns: string): CronSelectBuilder;
  insert(values: Record<string, unknown>): PromiseLike<{ error: unknown }>;
}

export interface SupabaseCronClient {
  from(table: string): unknown;
}

function isCronTableBuilder(value: unknown): value is CronTableBuilder {
  return typeof value === "object" && value !== null && "select" in value && "insert" in value;
}

/** Restituisce il query builder della tabella o lancia (i caller sono fail-open). */
export function cronTable(client: SupabaseCronClient, table: string): CronTableBuilder {
  const builder = client.from(table);
  if (!isCronTableBuilder(builder)) {
    throw new TypeError(`cronTable: client non compatibile per la tabella ${table}`);
  }
  return builder;
}
