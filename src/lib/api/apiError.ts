/**
 * apiError — Risposta di errore standardizzata per i contratti API.
 *
 * Vol. II §5.3 "Gestione degli errori nelle API":
 *   "Ogni risposta di errore deve avere una struttura standard: un codice
 *    HTTP appropriato, un codice di errore applicativo, un messaggio
 *    leggibile, eventuali dettagli strutturati. Il client non deve mai
 *    dover analizzare stringhe per capire cosa sia successo: deve poter
 *    agire in base al codice di errore."
 *
 * Strategia: tutti i moduli API throw `ApiError` con `code` esplicito.
 * I chiamanti possono fare `instanceof ApiError` e leggere `code`,
 * `httpStatus`, `details` senza parsing di stringhe.
 */

export type ApiErrorCode =
  | "NETWORK_ERROR"           // Connessione fallita / timeout
  | "UNAUTHENTICATED"         // 401 — sessione assente/scaduta
  | "FORBIDDEN"               // 403 — utente non autorizzato
  | "NOT_FOUND"               // 404 — risorsa inesistente
  | "VALIDATION_FAILED"       // 422 — input non valido
  | "RATE_LIMITED"            // 429 — troppe richieste
  | "SERVER_ERROR"            // 5xx — errore interno
  | "SCHEMA_MISMATCH"         // Risposta non conforme al contratto runtime
  | "UNKNOWN_ERROR";          // Categoria di fallback

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  httpStatus?: number;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus?: number;
  readonly details?: Record<string, unknown>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.httpStatus = payload.httpStatus;
    this.details = payload.details;
  }

  /**
   * Costruisce ApiError dall'errore generico catturato in un blocco
   * try/catch. Mappa Error/TypeError/Response in categorie esplicite.
   */
  static from(err: unknown, context?: string): ApiError {
    if (err instanceof ApiError) return err;

    if (err instanceof Error) {
      // Rete: TypeError "Failed to fetch", AbortError, ecc.
      if (err.name === "TypeError" || err.message.toLowerCase().includes("fetch")) {
        return new ApiError({
          code: "NETWORK_ERROR",
          message: err.message,
          details: context ? { context } : undefined,
        });
      }
      return new ApiError({
        code: "UNKNOWN_ERROR",
        message: err.message,
        details: context ? { context } : undefined,
      });
    }

    return new ApiError({
      code: "UNKNOWN_ERROR",
      message: typeof err === "string" ? err : "Errore sconosciuto",
      details: context ? { context } : undefined,
    });
  }

  /**
   * Costruisce ApiError da una Response HTTP non-ok. Mappa il codice HTTP
   * a un ApiErrorCode applicativo. Tenta di estrarre `error`/`message`
   * dal body JSON se disponibile.
   */
  static async fromResponse(res: Response, context?: string): Promise<ApiError> {
    const code: ApiErrorCode =
      res.status === 401 ? "UNAUTHENTICATED" :
      res.status === 403 ? "FORBIDDEN" :
      res.status === 404 ? "NOT_FOUND" :
      res.status === 422 ? "VALIDATION_FAILED" :
      res.status === 429 ? "RATE_LIMITED" :
      res.status >= 500 ? "SERVER_ERROR" :
      "UNKNOWN_ERROR";

    let message = `HTTP ${res.status}`;
    let details: Record<string, unknown> | undefined;
    try {
      const body = await res.clone().json();
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (typeof b.error === "string") message = b.error;
        else if (typeof b.message === "string") message = b.message;
        details = b;
      }
    } catch (e) {
      console.debug("operation failed");
      /* body non JSON o vuoto: lascia il default */
    }

    return new ApiError({
      code,
      message,
      httpStatus: res.status,
      details: { ...(details || {}), ...(context ? { context } : {}) },
    });
  }

  /** Serializza in JSON-friendly per logging strutturato */
  toJSON(): ApiErrorPayload {
    return {
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      details: this.details,
    };
  }
}

/** Type guard usabile dai chiamanti */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
