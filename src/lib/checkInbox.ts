import { invokeEdge } from "@/lib/api/invokeEdge";
import { safeParseCheckInboxResult } from "@/lib/api/checkInbox.schemas";

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
  const json = await invokeEdge<unknown>("check-inbox", {
    body: {},
    context: "callCheckInbox",
  });
  // best-effort runtime check (mai bloccante)
  safeParseCheckInboxResult(json);
  return json;
}
