/**
 * Narrowing runtime verso record generici.
 *
 * Sostituisce l'idioma `toRecord(x)`, che è un
 * doppio cast cieco: qui il tipo è ristretto SOLO dopo un controllo runtime
 * reale, quindi un valore non-oggetto non entra mai nel dominio come record.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  // Preserva la semantica dei wrapper non-JSON: Date/Map/Set non sono record.
  if (value instanceof Date || value instanceof Map || value instanceof Set) return false;
  return true;
}

export function toRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}

/** Variante che preserva l'assenza di valore (null/undefined -> null). */
export function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  return isPlainRecord(value) ? value : null;
}

/** Lista di record: gli elementi non-oggetto vengono scartati (fail closed). */
export function toRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord);
}

/** `window` come record generico, per accessi a proprietà iniettate a runtime. */
export function windowRecord(): Record<string, unknown> {
  return toRecord(typeof window === "undefined" ? null : window);
}
