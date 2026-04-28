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

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;

function wrapBuilder(table: string, builder: any): any {
  // I metodi che terminano la query e ritornano una Promise sono `then`-able.
  // Strategy: wrap la `then` del builder.
  if (!builder || typeof builder.then !== "function") return builder;

  const originalThen: AnyFn = builder.then.bind(builder);
  const ops: string[] = [];

  // Track quale verbo è stato chiamato sul builder
  for (const verb of ["select", "insert", "update", "delete", "upsert"] as const) {
    if (typeof builder[verb] === "function") {
      const orig: AnyFn = builder[verb].bind(builder);
      builder[verb] = (...args: any[]) => {
        ops.push(verb);
        return wrapBuilder(table, orig(...args));
      };
    }
  }

  builder.then = (onFulfilled?: AnyFn, onRejected?: AnyFn) => {
    const start = Date.now();
    return originalThen(
      (res: any) => {
        const route = typeof window !== "undefined" ? window.location.pathname : undefined;
        const op = ops[ops.length - 1] ?? "select";
        const count = Array.isArray(res?.data) ? res.data.length : res?.data ? 1 : 0;
        traceCollector.push({
          type: "db.query",
          scope: "db",
          source: `${op}:${table}`,
          route,
          status: res?.error ? "error" : "success",
          duration_ms: Date.now() - start,
          payload_summary: { table, op, count, status: res?.status },
          error: res?.error ? { message: String(res.error.message ?? res.error), code: res.error.code } : undefined,
        });
        return onFulfilled ? onFulfilled(res) : res;
      },
      (err: any) => {
        const route = typeof window !== "undefined" ? window.location.pathname : undefined;
        traceCollector.push({
          type: "db.query",
          scope: "db",
          source: `${ops[ops.length - 1] ?? "?"}:${table}`,
          route,
          status: "error",
          duration_ms: Date.now() - start,
          payload_summary: { table },
          error: { message: err?.message ?? String(err), code: err?.code },
        });
        if (onRejected) return onRejected(err);
        throw err;
      },
    );
  };

  return builder;
}

export function installSupabaseTraceProxy(): void {
  if (installed) return;
  installed = true;
  const sb = supabase as unknown as { from: AnyFn; rpc: AnyFn };
  const originalFrom = sb.from.bind(supabase);
  sb.from = (table: string) => wrapBuilder(table, originalFrom(table));

  const originalRpc = sb.rpc.bind(supabase);
  sb.rpc = (fnName: string, params?: any) => {
    const start = Date.now();
    const result = originalRpc(fnName, params);
    if (result && typeof result.then === "function") {
      const original = result.then.bind(result);
      result.then = (ok?: AnyFn, ko?: AnyFn) =>
        original(
          (r: any) => {
            traceCollector.push({
              type: "db.query",
              scope: "db",
              source: `rpc:${fnName}`,
              route: typeof window !== "undefined" ? window.location.pathname : undefined,
              status: r?.error ? "error" : "success",
              duration_ms: Date.now() - start,
              payload_summary: { rpc: fnName },
              error: r?.error ? { message: String(r.error.message ?? r.error), code: r.error.code } : undefined,
            });
            return ok ? ok(r) : r;
          },
          (err: any) => {
            traceCollector.push({
              type: "db.query",
              scope: "db",
              source: `rpc:${fnName}`,
              status: "error",
              duration_ms: Date.now() - start,
              error: { message: err?.message ?? String(err) },
            });
            if (ko) return ko(err);
            throw err;
          },
        );
    }
    return result;
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */