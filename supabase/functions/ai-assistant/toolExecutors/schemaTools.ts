/**
 * schemaTools.ts — Grounding sui dati reali.
 *
 * Tre strumenti pensati per eliminare il problema "l'AI non trova il dato
 * perché non conosce il nome esatto del campo":
 *  - find_anything    → ricerca trasversale su tutte le entità (RPC ai_find_anything)
 *  - inspect_field    → valori reali di un campo (RPC ai_field_values, stile tmwe_campi)
 *  - describe_tables  → colonne + enum reali (RPC ai_introspect_schema)
 */

import type { AnySupabaseClient } from "../../_shared/supabaseClient.ts";
import { extractErrorMessage } from "../../_shared/handleEdgeError.ts";

/** RPC non presenti nei tipi generati: accesso tipizzato in modo lasco. */
interface LooseRpcClient {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}
const rpc = (c: AnySupabaseClient): LooseRpcClient => c as unknown as LooseRpcClient;

/** Ricerca trasversale: nome, email, indirizzo, telefono, città, P.IVA… */
export async function executeFindAnything(
  supabase: AnySupabaseClient,
  args: Record<string, unknown>,
): Promise<unknown> {
  const query = String(args.query ?? "").trim();
  if (query.length < 2) return { error: "Query troppo corta (min 2 caratteri)" };
  const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 50);

  try {
    const { data, error } = await rpc(supabase).rpc("ai_find_anything", { p_query: query, p_limit: limit });
    if (error) return { error: error.message };

    const payload = (data ?? {}) as Record<string, unknown>;
    const results = Array.isArray(payload.results) ? payload.results : [];
    if (results.length === 0) {
      return {
        query,
        total_matches: 0,
        results: [],
        next_step:
          "Nessuna corrispondenza. Prima di dire che il dato non esiste, prova una variante più corta del termine " +
          "(es. solo il cognome o la radice del nome azienda) oppure usa inspect_field per verificare se il campo è popolato.",
      };
    }
    return {
      ...payload,
      count_disclosure: payload.partial
        ? `Mostrati ${results.length} risultati (limite ${limit}): il totale reale può essere superiore. Dichiaralo all'utente.`
        : `Risultati completi: ${results.length}.`,
    };
  } catch (err: unknown) {
    return { error: extractErrorMessage(err) };
  }
}

/** Introspezione dei valori reali di un campo. */
export async function executeInspectField(
  supabase: AnySupabaseClient,
  args: Record<string, unknown>,
): Promise<unknown> {
  const table = String(args.table ?? "").trim();
  const column = String(args.column ?? "").trim();
  if (!table || !column) return { error: "Servono 'table' e 'column'" };
  const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 100);
  const filter = args.contains ? String(args.contains) : null;

  try {
    const { data, error } = await rpc(supabase).rpc("ai_field_values", {
      p_table: table,
      p_column: column,
      p_limit: limit,
      p_filter: filter,
    });
    if (error) return { error: error.message };
    return data;
  } catch (err: unknown) {
    return { error: extractErrorMessage(err) };
  }
}

/** Colonne, tipi ed enum reali delle tabelle richieste. */
export async function executeDescribeTables(
  supabase: AnySupabaseClient,
  args: Record<string, unknown>,
): Promise<unknown> {
  const raw = args.tables;
  const tables = Array.isArray(raw)
    ? raw.map((t) => String(t).trim()).filter(Boolean)
    : String(raw ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  if (tables.length === 0) return { error: "Indica almeno una tabella in 'tables'" };

  try {
    const { data, error } = await rpc(supabase).rpc("ai_introspect_schema", { table_names: tables.slice(0, 12) });
    if (error) return { error: error.message };
    const list = Array.isArray(data) ? data : [];
    const missing = tables.filter(
      (t) => !list.some((entry) => (entry as { table?: string })?.table === t),
    );
    return {
      schema: list,
      missing_tables: missing,
      hint: "Usa questi nomi di colonna esatti nei filtri. Per sapere quali VALORI contiene una colonna usa inspect_field.",
    };
  } catch (err: unknown) {
    return { error: extractErrorMessage(err) };
  }
}
