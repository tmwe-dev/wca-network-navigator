import { corsHeaders } from "./cors.ts";

/**
 * Contratto canonico di errore Edge (retro-compatibile).
 *
 * Body minimo garantito: `{ error: string, code: EdgeErrorCode }`.
 * `details` è opzionale; `extra` consente di preservare campi legacy
 * già consumati dal frontend (es. `voices`, `debug`, `status`) senza
 * cambiare la semantica delle risposte esistenti.
 */
export interface EdgeErrorResponse {
  error: string;
  code: string;
  details?: string;
  [key: string]: unknown;
}

export type EdgeErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

/** Alias storico mantenuto per i consumer interni già esistenti. */
export type ErrorCode = EdgeErrorCode;

export const EDGE_ERROR_STATUS: Record<EdgeErrorCode, number> = {
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export const EDGE_ERROR_CODES = Object.keys(EDGE_ERROR_STATUS) as EdgeErrorCode[];

/** Type guard sul contratto canonico (usabile anche lato consumer). */
export function isEdgeErrorBody(value: unknown): value is EdgeErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.error === "string" && typeof v.code === "string";
}

export function edgeError(
  code: EdgeErrorCode,
  message: string,
  details?: string,
  customHeaders?: Record<string, string>,
  /** Campi legacy additivi da preservare nel body (retro-compatibilità). */
  extra?: Record<string, unknown>,
): Response {
  const status = EDGE_ERROR_STATUS[code];
  const body: EdgeErrorResponse = { ...(extra ?? {}), error: message, code };
  if (details) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(customHeaders || corsHeaders), "Content-Type": "application/json" },
  });
}

/**
 * Variante che conserva uno status HTTP legacy diverso da quello canonico
 * (usata dove cambiare status romperebbe consumer esistenti).
 */
export function edgeErrorWithStatus(
  code: EdgeErrorCode,
  message: string,
  status: number,
  customHeaders?: Record<string, string>,
  extra?: Record<string, unknown>,
): Response {
  const body: EdgeErrorResponse = { ...(extra ?? {}), error: message, code };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(customHeaders || corsHeaders), "Content-Type": "application/json" },
  });
}

export function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}
