import { toRecord, toRecordOrNull, toRecords } from "@/lib/records";
/**
 * Narrowing runtime verso record generici.
 *
 * Sostituisce l'idioma `toRecord(x)`, che è un
 * doppio cast cieco: qui il tipo è ristretto SOLO dopo un controllo runtime
 * reale, quindi un valore non-oggetto non entra mai nel dominio come record.
 */
export function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Variante che preserva l'assenza di valore (null/undefined -> null). */
export function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Lista di record: gli elementi non-oggetto vengono scartati (fail closed). */
export function toRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v),
  );
}

/** `window` come record generico, per accessi a proprietà iniettate a runtime. */
export function windowRecord(): Record<string, unknown> {
  return toRecord(typeof window === "undefined" ? null : window);
}
