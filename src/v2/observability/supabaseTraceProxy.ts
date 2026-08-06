/**
 * Monkey-patch leggero del client supabase per emettere `db.query` events
 * verso il traceCollector. NON tocca client.ts (file protetto) — wrap i
 * metodi del builder restituito da supabase.from(table).
 *
 * Sicurezza: preserva firma originale e comportamento; solo aggiunge timing
 * + emit nel finally. Se qualcosa va storto, non blocca la query.
 */
import { supabase } from "@/integrations/supabase/client";
import { traceCollector } from "./traceCollector";

let installed = false;

// Firma generica per i metodi runtime del query builder Supabase (then/select/
// insert/...): gli argomenti e il ritorno variano per verbo e non sono
// esportati come tipo pubblico dal client generato, quindi restano `unknown`.
type AnyFn = (...args: unknown[]) => unknown;

/** Forma minima e comune a tutte le risposte Supabase (`{ data, error, status }`). */
interface QueryResult {
  data?: unknown;
  error?: { message?: unknown; code?: unknown } | null;
  status?: unknown;
}

// Il builder di supabase.from(table) è un oggetto proxy interno la cui shape
// esatta (query builder concatenabile + thenable) non è esposta come tipo
// pubblico dal client generato: usiamo un indice dinamico e restiamo su
// `unknown` per i valori, narrowing puntuale dove serve.
type QueryBuilder = { then?: AnyFn; [key: string]: unknown };

function wrapBuilder(table: string, builder: unknown): unknown {
  // I metodi che terminano la query e ritornano una Promise sono `then`-abili.
  // Strategy: wrap la `then` del builder.
  const b = builder as QueryBuilder | null | undefined;
  if (!b || typeof b.then !== "function") return builder;

  const originalThen = (b.then as AnyFn).bind(b);
  const ops: string[] = [];

  // Track quale verbo è stato chiamato sul builder
  for (const verb of ["select", "insert", "update", "delete", "upsert"] as const) {
    if (typeof b[verb] === "function") {
      const orig = (b[verb] as AnyFn).bind(b);
      b[verb] = (...args: unknown[]) => {
        ops.push(verb);
        return wrapBuilder(table, orig(...args));
      };
    }
  }

  b.then = ((onFulfilled?: AnyFn, onRejected?: AnyFn) => {
    const start = Date.now();
    return originalThen(
      (res: unknown) => {
        const r = res as QueryResult | undefined;
        const route = typeof window !== "undefined" ? window.location.pathname : undefined;
        const op = ops[ops.length - 1] ?? "select";
        const count = Array.isArray(r?.data) ? r.data.length : r?.data ? 1 : 0;
        traceCollector.push({
          type: "db.query",
          scope: "db",
          source: `${op}:${table}`,
          route,
          status: r?.error ? "error" : "success",
          duration_ms: Date.now() - start,
          payload_summary: { table, op, count, status: r?.status },
          error: r?.error
            ? { message: String(r.error.message ?? r.error), code: r.error.code as string | undefined }
            : undefined,
        });
        return onFulfilled ? onFulfilled(res) : res;
      },
      (err: unknown) => {
        const route = typeof window !== "undefined" ? window.location.pathname : undefined;
        const e = err as { message?: unknown; code?: unknown } | undefined;
        traceCollector.push({
          type: "db.query",
          scope: "db",
          source: `${ops[ops.length - 1] ?? "?"}:${table}`,
          route,
          status: "error",
          duration_ms: Date.now() - start,
          payload_summary: { table },
          error: {
            message: e?.message !== undefined ? String(e.message) : String(err),
            code: e?.code as string | undefined,
          },
        });
        if (onRejected) return onRejected(err);
        throw err;
      },
    );
  }) as AnyFn;

  return builder;
}

export function installSupabaseTraceProxy(): void {
  if (installed) return;
  installed = true;
  // `supabase.from`/`.rpc` sono monkey-patchati a runtime senza cambiare il
  // tipo pubblico del client (protetto): l'oggetto locale con firme `AnyFn`
  // è l'unico modo di riassegnare questi metodi senza toccare client.ts.
  const sb = supabase as unknown as { from: AnyFn; rpc: AnyFn };
  const originalFrom = sb.from.bind(supabase);
  sb.from = (table: unknown) => wrapBuilder(table as string, originalFrom(table));

  const originalRpc = sb.rpc.bind(supabase);
  sb.rpc = (fnName: unknown, params?: unknown) => {
    const start = Date.now();
    const result = originalRpc(fnName, params) as QueryBuilder | unknown;
    const r = result as QueryBuilder | null | undefined;
    if (r && typeof r.then === "function") {
      const original = (r.then as AnyFn).bind(r);
      r.then = ((ok?: AnyFn, ko?: AnyFn) =>
        original(
          (res: unknown) => {
            const rr = res as QueryResult | undefined;
            traceCollector.push({
              type: "db.query",
              scope: "db",
              source: `rpc:${String(fnName)}`,
              route: typeof window !== "undefined" ? window.location.pathname : undefined,
              status: rr?.error ? "error" : "success",
              duration_ms: Date.now() - start,
              payload_summary: { rpc: String(fnName) },
              error: rr?.error
                ? { message: String(rr.error.message ?? rr.error), code: rr.error.code as string | undefined }
                : undefined,
            });
            return ok ? ok(res) : res;
          },
          (err: unknown) => {
            const e = err as { message?: unknown } | undefined;
            traceCollector.push({
              type: "db.query",
              scope: "db",
              source: `rpc:${String(fnName)}`,
              status: "error",
              duration_ms: Date.now() - start,
              error: { message: e?.message !== undefined ? String(e.message) : String(err) },
            });
            if (ko) return ko(err);
            throw err;
          },
        )) as AnyFn;
    }
    return result;
  };
}
