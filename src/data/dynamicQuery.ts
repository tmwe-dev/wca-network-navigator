/**
 * DAL — esecuzione di SELECT su tabella determinata a runtime.
 *
 * CONFINE SANZIONATO: è l'unico punto dell'applicazione in cui il nome della
 * tabella non è noto staticamente (piani di query generati dal planner AI).
 * Il chiamante DEVE aver già validato tabella, colonne e operatori contro una
 * whitelist; qui si esegue soltanto, tramite il boundary untyped centralizzato.
 * Nessun altro modulo deve importare `untypedFrom` per lo stesso scopo.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

export type DynamicSelectBuilder = ReturnType<typeof untypedFrom> extends { select: infer _S }
  ? ReturnType<ReturnType<typeof untypedFrom>["select"]>
  : never;

/** Avvia una SELECT su una tabella già validata dal chiamante. */
export function selectFromValidatedTable(
  validatedTable: string,
  columns: string,
  options?: { readonly count?: "exact" },
) {
  return untypedFrom(validatedTable).select(columns, options);
}
