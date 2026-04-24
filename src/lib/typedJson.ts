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