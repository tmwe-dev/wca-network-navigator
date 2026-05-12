import { invokeEdge } from "@/lib/api/invokeEdge";
import { safeParseCheckInboxResult } from "@/lib/api/checkInbox.schemas";
import { ApiError } from "@/lib/api/apiError";
import { createLogger } from "@/lib/log";

const log = createLogger("callCheckInbox");

let inFlightCheckInbox: Promise<unknown> | null = null;

function isSkippableCheckInboxError(err: unknown): err is ApiError {
  if (!(err instanceof ApiError)) return false;

  const body = err.details?.body as Record<string, unknown> | undefined;
  const bodyCode = typeof body?.code === "string" ? body.code : undefined;
  const isRuntimeBootError =
    err.httpStatus === 503 ||
    /SUPABASE_EDGE_RUNTIME_ERROR|temporarily unavailable/i.test(err.message);
  const isResourceLimitError =
    err.httpStatus === 546 ||
    bodyCode === "WORKER_RESOURCE_LIMIT" ||
    /WORKER_RESOURCE_LIMIT|not having enough compute resources|CPU Time exceeded/i.test(err.message);

  return isRuntimeBootError || isResourceLimitError;
}

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
export async function callCheckInbox(mailboxId?: string | null): Promise<unknown> {
  if (inFlightCheckInbox) {
    log.warn("check-inbox already running, joining existing invocation");
    return inFlightCheckInbox;
  }

  inFlightCheckInbox = callCheckInboxOnce(mailboxId ?? null).finally(() => {
    inFlightCheckInbox = null;
  });

  return inFlightCheckInbox;
}

async function callCheckInboxOnce(mailboxId: string | null): Promise<unknown> {
  try {
    const json = await invokeEdge<unknown>("check-inbox", {
      body: {},
      context: "callCheckInbox",
      headers: mailboxId ? { "x-mailbox-id": mailboxId } : undefined,
    });
    // best-effort runtime check (mai bloccante)
    safeParseCheckInboxResult(json);
    return json;
  } catch (err) {
    // Sess #25/26: runtime boot errors e CPU/resource-limit sono transitori
    // per il client. Non propaghiamo: evitiamo crash/blank screen e il
    // prossimo tick o scaricamento manuale riprenderà senza duplicare side effect.
    if (isSkippableCheckInboxError(err)) {
      log.warn("check-inbox skipped this tick", {
        status: err.httpStatus,
        code: (err.details?.body as Record<string, unknown> | undefined)?.code,
      });
      return { total: 0, matched: 0, transient: true, resourceLimit: err.httpStatus === 546 };
    }
    throw err;
  }
}
