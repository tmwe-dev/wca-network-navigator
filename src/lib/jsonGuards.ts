/**
 * Conversioni strutturali sicure verso il tipo `Json` di Supabase e
 * type guard riusabili per payload provenienti da RPC.
 *
 * Obiettivo: eliminare i cast opachi (`x as Json`, `x as T[]`) al confine DAL.
 * Nessun cast: ogni valore viene ispezionato e ricostruito.
 */
import type { Json } from "@/integrations/supabase/types";

/**
 * Converte un valore arbitrario in `Json` ricostruendolo ricorsivamente.
 * - primitivi JSON-compatibili passano invariati
 * - `undefined` e i valori non serializzabili (funzioni, symbol) vengono
 *   omessi dagli oggetti e mappati a `null` dentro gli array
 * - `Date` viene serializzata in ISO string (come farebbe `JSON.stringify`)
 * Ritorna `null` se il valore non è rappresentabile.
 */
export function toJsonValue(value: unknown): Json {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean") return value as string | boolean;
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item));
  if (t === "object") {
    const out: { [k: string]: Json } = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      const converted = toJsonValue(item);
      if (converted === null && item !== null && !isJsonRepresentable(item)) continue;
      out[key] = converted;
    }
    return out;
  }
  return null;
}

function isJsonRepresentable(value: unknown): boolean {
  const t = typeof value;
  return value === null || t === "string" || t === "number" || t === "boolean" || t === "object";
}

/** True se il valore è un oggetto non-array (record). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Lettura tipizzata di una stringa da un record sconosciuto. */
export function readString(source: Record<string, unknown>, key: string): string | null {
  const v = source[key];
  return typeof v === "string" ? v : null;
}

/** Lettura tipizzata di un booleano da un record sconosciuto. */
export function readBoolean(source: Record<string, unknown>, key: string): boolean | null {
  const v = source[key];
  return typeof v === "boolean" ? v : null;
}

/** Lettura tipizzata di un array di stringhe (null se assente o non conforme). */
export function readStringArray(source: Record<string, unknown>, key: string): string[] | null {
  const v = source[key];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}