/**
 * safeQueryExecutor — Esecutore client-side di query AI-generate.
 *
 * Riceve un `QueryPlan` prodotto dall'AI Query Planner, lo valida contro:
 *   • whitelist tabelle business (ALLOWED_TABLES)
 *   • whitelist operatori (eq, neq, gt, gte, lt, lte, ilike, in, is)
 *   • cap limit hard (max 200, default 50)
 *   • whitelist colonne (devono esistere nello schema)
 *
 * Esegue via supabase.from() rispettando RLS.
 * Solo SELECT — nessuna mutazione consentita.
 */
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { DB_SCHEMA, ALLOWED_TABLES, type TableDescriptor } from "@/v2/agent/kb/dbSchema";

export const QueryFilterSchema = z.object({
  column: z.string(),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number()]))]),
});

export const QueryPlanSchema = z.object({
  table: z.string(),
  columns: z.array(z.string()).optional(),
  filters: z.array(QueryFilterSchema).default([]),
  sort: z
    .object({
      column: z.string(),
      ascending: z.boolean().default(false),
    })
    .optional(),
  limit: z.number().int().min(1).max(200).default(50),
  title: z.string().optional(),
  rationale: z.string().optional(),
});

export type QueryFilter = z.infer<typeof QueryFilterSchema>;
export type QueryPlan = z.infer<typeof QueryPlanSchema>;

const HARD_LIMIT = 200;

export interface ExecutorResult {
  readonly rows: Record<string, unknown>[];
  readonly count: number;
  readonly table: string;
  readonly columnsUsed: string[];
}

export class QueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}

function findTable(name: string): TableDescriptor | undefined {
  return DB_SCHEMA.find((t) => t.name === name);
}

function validatePlan(plan: QueryPlan): TableDescriptor {
  if (!ALLOWED_TABLES.has(plan.table)) {
    throw new QueryValidationError(
      `Tabella "${plan.table}" non consentita. Tabelle disponibili: ${[...ALLOWED_TABLES].join(", ")}`,
    );
  }

  const table = findTable(plan.table);
  if (!table) throw new QueryValidationError(`Tabella "${plan.table}" non trovata nello schema.`);

  const validColumns = new Set(table.columns.map((c) => c.name));

  for (const f of plan.filters) {
    if (!validColumns.has(f.column)) {
      throw new QueryValidationError(
        `Colonna filtro "${f.column}" non valida per "${plan.table}".`,
      );
    }
    if (f.op === "in" && !Array.isArray(f.value)) {
      throw new QueryValidationError(`Operatore "in" richiede un array per "${f.column}".`);
    }
  }

  if (plan.sort && !validColumns.has(plan.sort.column)) {
    throw new QueryValidationError(`Colonna sort "${plan.sort.column}" non valida.`);
  }

  if (plan.columns) {
    for (const c of plan.columns) {
      if (!validColumns.has(c)) {
        throw new QueryValidationError(`Colonna select "${c}" non valida.`);
      }
    }
  }

  return table;
}

export async function executeQueryPlan(rawPlan: unknown): Promise<ExecutorResult> {
  const parsed = QueryPlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    throw new QueryValidationError(`QueryPlan malformato: ${parsed.error.message}`);
  }
  const plan = parsed.data;
  const table = validatePlan(plan);

  // Determina colonne da selezionare
  const selectCols = plan.columns?.length
    ? plan.columns.join(",")
    : table.columns.slice(0, 10).map((c) => c.name).join(",");

  // Cap limit
  const limit = Math.min(plan.limit ?? 50, HARD_LIMIT);

  // Costruisci query (cast a any per supportare tabelle whitelistate dinamicamente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(plan.table as never).select(selectCols, { count: "exact" });

  for (const f of plan.filters) {
    switch (f.op) {
      case "eq":
        q = q.eq(f.column, f.value);
        break;
      case "neq":
        q = q.neq(f.column, f.value);
        break;
      case "gt":
        q = q.gt(f.column, f.value);
        break;
      case "gte":
        q = q.gte(f.column, f.value);
        break;
      case "lt":
        q = q.lt(f.column, f.value);
        break;
      case "lte":
        q = q.lte(f.column, f.value);
        break;
      case "ilike":
        q = q.ilike(f.column, typeof f.value === "string" ? `%${f.value}%` : String(f.value));
        break;
      case "in":
        q = q.in(f.column, f.value as (string | number)[]);
        break;
      case "is":
        q = q.is(f.column, f.value as null | boolean);
        break;
    }
  }

  if (plan.sort) {
    q = q.order(plan.sort.column, { ascending: plan.sort.ascending });
  } else if (table.defaultSort) {
    q = q.order(table.defaultSort.column, { ascending: table.defaultSort.ascending });
  }

  q = q.limit(limit);

  const { data, error, count } = await q;
  if (error) throw new Error(`Query fallita: ${error.message}`);

  return {
    rows: (data ?? []) as Record<string, unknown>[],
    count: count ?? (Array.isArray(data) ? data.length : 0),
    table: plan.table,
    columnsUsed: plan.columns ?? table.columns.slice(0, 10).map((c) => c.name),
  };
}
