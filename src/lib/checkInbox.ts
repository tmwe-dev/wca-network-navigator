import { invokeEdge } from "@/lib/api/invokeEdge";
import { safeParseCheckInboxResult } from "@/lib/api/checkInbox.schemas";
import { ApiError } from "@/lib/api/apiError";
import { createLogger } from "@/lib/log";

const log = createLogger("callCheckInbox");

/**
 * callCheckInbox — chiama la edge function `check-inbox` via invokeEdge.
 *
 * Vol. II §5.3: errori standardizzati via `ApiError` con `code` esplicito
 * (gestito da invokeEdge che normalizza FunctionsHttpError → ApiError).
 * Vol. II §5.3: validazione runtime best-effort della risposta via zod
 * (strangler — log warn su mismatch, mai throw).
 *
 * Sess #24: migrato da bare fetch a invokeEdge per coerenza con gli
 * altri 37 callsite e per beneficiare del logging strutturato + body
 * extraction da FunctionsHttpError.
 */
export async function callCheckInbox(): Promise<unknown> {
  try {
    const json = await invokeEdge<unknown>("check-inbox", {
      body: {},
      context: "callCheckInbox",
    });
    // best-effort runtime check (mai bloccante)
    safeParseCheckInboxResult(json);
    return json;
  } catch (err) {
    // Sess #25: il runtime Supabase Edge restituisce sporadicamente 503
    // ({"code":"SUPABASE_EDGE_RUNTIME_ERROR"}) durante boot/restart del
    // container. È transitorio: il prossimo tick di sync recupera senza
    // perdita di email. Non propaghiamo per evitare toast/blank screen.
    const isTransient =
      err instanceof ApiError &&
      (err.httpStatus === 503 ||
        /SUPABASE_EDGE_RUNTIME_ERROR|temporarily unavailable/i.test(err.message));
    if (isTransient) {
      log.warn("check-inbox transient 503, skipping this tick", {
        status: err instanceof ApiError ? err.httpStatus : undefined,
      });
      return { total: 0, matched: 0, transient: true };
    }
    throw err;
  }
}
