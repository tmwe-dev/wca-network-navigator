/**
 * edgeErrorContract — contratto canonico di errore delle Edge Functions,
 * lato consumer (specchio di `supabase/functions/_shared/handleEdgeError.ts`).
 *
 * Body canonico: `{ error: string, code: EdgeErrorCode, details?: string, ...legacy }`.
 * Il parser è retro-compatibile: accetta anche i body legacy
 * (`{ error }`, `{ message }`, `{ success, error }`) senza `code`.
 */

export const EDGE_ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
] as const;

export type EdgeErrorCode = (typeof EDGE_ERROR_CODES)[number];

export interface ParsedEdgeError {
  /** Codice canonico se il body lo dichiara, altrimenti null (body legacy). */
  code: EdgeErrorCode | null;
  /** Codice grezzo dichiarato dal body, anche se non canonico. */
  rawCode: string | null;
  /** Messaggio leggibile estratto dal body, se presente. */
  message: string | null;
  details: string | null;
}

/** Narrowing senza assertion sul set di codici canonici. */
export function toEdgeErrorCode(value: string): EdgeErrorCode | null {
  switch (value) {
    case "AUTH_REQUIRED":
    case "AUTH_INVALID":
    case "VALIDATION_ERROR":
    case "NOT_FOUND":
    case "RATE_LIMITED":
    case "UPSTREAM_ERROR":
    case "INTERNAL_ERROR":
      return value;
    default:
      return null;
  }
}

/**
 * Estrae il contratto di errore da un body sconosciuto. Non lancia mai:
 * restituisce `null` se il body non contiene alcuna informazione d'errore.
 */
export function parseEdgeErrorBody(body: unknown): ParsedEdgeError | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const rawCode = typeof b.code === "string" ? b.code : null;
  const message =
    typeof b.error === "string"
      ? b.error
      : typeof b.message === "string"
        ? b.message
        : null;
  const details = typeof b.details === "string" ? b.details : null;

  if (rawCode === null && message === null) return null;

  return {
    code: rawCode ? toEdgeErrorCode(rawCode) : null,
    rawCode,
    message,
    details,
  };
}