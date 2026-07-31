/**
 * P3.6 — TypedJson helpers
 *
 * Centralizza il parsing sicuro delle colonne `Json` di Supabase.
 * Prima del refactor erano sparsi cast `as Record<string, unknown>` e
 * `JSON.parse(...)` senza guardia. Questi helper:
 *  - normalizzano `Json | null | undefined | string` in oggetto/array,
 *  - non lanciano mai (ritornano fallback),
 *  - permettono di marcare il tipo target con un parametro generico.
 *
 * NB: la validazione runtime profonda è demandata a Zod nei boundary
 * critici. Qui forniamo solo un cast sicuro con normalizzazione.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

function tryParse(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

/**
 * Tratta un valore `Json | string | null | unknown` come oggetto.
 * Ritorna `{}` se il valore è null, array, primitivo, JSON malformato.
 */
export function asJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
  fallback: T = {} as T,
): T {
  const parsed = tryParse(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as T;
  }
  return fallback;
}

/**
 * Tratta un valore `Json | string | null | unknown` come array.
 * Ritorna `[]` se non è un array (anche dopo parse).
 */
export function asJsonArray<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  const parsed = tryParse(value);
  if (Array.isArray(parsed)) return parsed as T[];
  return fallback;
}

/**
 * Estrae un campo da un oggetto Json applicando un cast tipato.
 * Utile per leggere `payload.draft_subject` da `action_payload: Json`.
 */
export function getJsonField<T = unknown>(value: unknown, key: string): T | undefined {
  const obj = asJsonObject(value);
  if (key in obj) return obj[key] as T;
  return undefined;
}

/**
 * Versione che restituisce sempre un valore (con fallback obbligatorio).
 */
export function getJsonFieldOr<T>(value: unknown, key: string, fallback: T): T {
  const v = getJsonField<T>(value, key);
  return v === undefined ? fallback : v;
}

/**
 * Unisce mutazioni a un Json esistente garantendo un oggetto.
 * Utile prima di un `update({ payload: mergeJsonObject(old, patch) })`.
 */
export function mergeJsonObject<T extends Record<string, unknown>>(
  base: unknown,
  patch: Partial<T>,
): T {
  const obj = asJsonObject<T>(base);
  return { ...obj, ...patch } as T;
}

/**
 * Normalizza un valore applicativo in `JsonValue` serializzabile.
 * Conversione ricorsiva esplicita (nessun `JSON.parse`, nessun implicit any):
 * ogni nodo viene ispezionato e ricostruito. `undefined`, funzioni e symbol
 * sono omessi dagli oggetti e mappati a `null` dentro gli array; `Date` è
 * serializzata in ISO string. I cicli sono interrotti con `null`.
 */
export function toJsonValue(value: unknown, seen: Set<object> = new Set()): JsonValue {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === "string") return value as string;
  if (t === "boolean") return value as boolean;
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : null;
  if (t === "bigint") return Number(value as bigint);
  if (t === "function" || t === "symbol") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      const arr: JsonValue[] = [];
      for (const item of value) arr.push(toJsonValue(item, seen));
      seen.delete(value);
      return arr;
    }
    const maybeToJson = (value as { toJSON?: unknown }).toJSON;
    if (typeof maybeToJson === "function") {
      const converted = toJsonValue((maybeToJson as () => unknown).call(value), seen);
      seen.delete(value);
      return converted;
    }
    const out: { [k: string]: JsonValue } = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      const it = typeof item;
      if (it === "function" || it === "symbol") continue;
      out[key] = toJsonValue(item, seen);
    }
    seen.delete(value);
    return out;
  }
  return null;
}