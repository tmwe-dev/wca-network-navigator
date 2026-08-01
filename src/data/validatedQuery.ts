/**
 * DAL — esecuzione di SELECT su tabella determinata a runtime.
 *
 * CONFINE SANZIONATO: è l'unico punto dell'applicazione in cui il nome della
 * tabella non è noto staticamente (piani di query generati dal planner AI).
 * Il chiamante DEVE aver già validato tabella, colonne e operatori contro una
 * whitelist; qui si esegue soltanto, tramite il boundary untyped centralizzato.
 * Nessun altro modulo deve importare `tFrom` per lo stesso scopo.
 */
import { tFrom } from "@/lib/typedSupabase";

export type DynamicSelectBuilder = ReturnType<typeof tFrom> extends { select: infer _S }
  ? ReturnType<ReturnType<typeof tFrom>["select"]>
  : never;

/** Avvia una SELECT su una tabella già validata dal chiamante. */
export function selectFromValidatedTable(
  validatedTable: string,
  columns: string,
  options?: { readonly count?: "exact" },
) {
  return tFrom(validatedTable).select(columns, options);
}

/** Operatori ammessi nei filtri generati a runtime. */
export type DynamicFilterOp = "eq" | "neq" | "ilike" | "in" | "is";

export interface DynamicFilter {
  readonly column: string;
  readonly op: string;
  readonly value: unknown;
}

const SUPPORTED_OPS: ReadonlySet<string> = new Set<DynamicFilterOp>([
  "eq",
  "neq",
  "ilike",
  "in",
  "is",
]);

/**
 * Applica filtri con nome colonna noto solo a runtime a una SELECT già avviata.
 *
 * `allowedColumns` è obbligatoria: le colonne non in whitelist vengono scartate
 * (fail closed) invece di raggiungere il database. Gli operatori non supportati
 * vengono ignorati allo stesso modo.
 */
export function applyValidatedFilters<TBuilder>(
  builder: TBuilder,
  filters: readonly DynamicFilter[],
  allowedColumns: ReadonlySet<string>,
): TBuilder {
  let q = builder as TBuilder & Record<DynamicFilterOp, (c: string, v: unknown) => TBuilder>;
  for (const f of filters) {
    if (!allowedColumns.has(f.column) || !SUPPORTED_OPS.has(f.op)) continue;
    switch (f.op) {
      case "eq":
        q = q.eq(f.column, f.value) as typeof q;
        break;
      case "neq":
        q = q.neq(f.column, f.value) as typeof q;
        break;
      case "ilike":
        q = q.ilike(f.column, `%${String(f.value).replace(/%/g, "")}%`) as typeof q;
        break;
      case "in":
        if (Array.isArray(f.value)) q = q.in(f.column, f.value) as typeof q;
        break;
      case "is":
        q = q.is(f.column, f.value) as typeof q;
        break;
    }
  }
  return q;
}

/**
 * UPDATE di una singola colonna il cui nome è noto solo a runtime.
 *
 * Tabella e colonna devono essere già validate dal chiamante contro una
 * whitelist; qui si esegue soltanto, sullo stesso boundary untyped.
 */
export async function updateValidatedColumn(
  validatedTable: string,
  validatedColumn: string,
  value: unknown,
  match: { readonly column: string; readonly value: unknown },
): Promise<void> {
  const { error } = await tFrom(validatedTable)
    .update({ [validatedColumn]: value })
    .eq(match.column, match.value);
  if (error) throw error;
}
