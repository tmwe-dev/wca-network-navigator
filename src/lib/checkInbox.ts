import { invokeEdge } from "@/lib/api/invokeEdge";
import { safeParseCheckInboxResult } from "@/lib/api/checkInbox.schemas";
import { ApiError } from "@/lib/api/apiError";
import { createLogger } from "@/lib/log";

const log = createLogger("callCheckInbox");

const inFlightCheckInbox = new Map<string, Promise<unknown>>();

function inFlightKey(mailboxId: string | null, unreadOnly: boolean): string {
  return `${mailboxId ?? "personal"}|${unreadOnly ? "u" : "all"}`;
}

function isSkippableCheckInboxError(err: unknown): err is ApiError {
  // Errori di rete (FunctionsFetchError, TypeError "Failed to fetch", CORS,
  // abort) arrivano come ApiError UNKNOWN_ERROR senza httpStatus. Vanno
  // trattati come transient: bgSyncStart farà back-off invece di rimbalzare.
  if (err instanceof ApiError && (err.httpStatus === undefined || err.httpStatus === null)) {
    return true;
  }
  if (!(err instanceof ApiError)) {
    // Edge-case: errore non-ApiError raw (es. TypeError di fetch) → transient.
    if (err instanceof Error && /Failed to (fetch|send)|FunctionsFetchError|FunctionsRelayError|NetworkError/i.test(err.message)) {
      return true;
    }
    return false;
  }

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
export interface CallCheckInboxOptions {
  readonly unreadOnly?: boolean;
}

export async function callCheckInbox(
  mailboxId?: string | null,
  opts: CallCheckInboxOptions = {},
): Promise<unknown> {
  const key = inFlightKey(mailboxId ?? null, !!opts.unreadOnly);
  const existing = inFlightCheckInbox.get(key);
  if (existing) {
    log.warn("check-inbox already running, joining existing invocation", { key });
    return existing;
  }

  const p = callCheckInboxOnce(mailboxId ?? null, opts).finally(() => {
    inFlightCheckInbox.delete(key);
  });
  inFlightCheckInbox.set(key, p);
  return p;
}

async function callCheckInboxOnce(
  mailboxId: string | null,
  opts: CallCheckInboxOptions,
): Promise<unknown> {
  try {
    const headers: Record<string, string> = {};
    if (mailboxId) headers["x-mailbox-id"] = mailboxId;
    if (opts.unreadOnly) headers["x-unread-only"] = "1";
    const json = await invokeEdge<unknown>("check-inbox", {
      body: {},
      context: "callCheckInbox",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    // best-effort runtime check (mai bloccante)
    safeParseCheckInboxResult(json);
    return json;
  } catch (err) {
    // Sess #25/26: runtime boot errors e CPU/resource-limit sono transitori
    // per il client. Non propaghiamo: evitiamo crash/blank screen e il
    // prossimo tick o scaricamento manuale riprenderà senza duplicare side effect.
    if (isSkippableCheckInboxError(err)) {
      const status = err instanceof ApiError ? err.httpStatus : undefined;
      const code = err instanceof ApiError ? (err.details?.body as Record<string, unknown> | undefined)?.code : undefined;
      log.warn("check-inbox skipped this tick", {
        status,
        code,
        name: err instanceof Error ? err.name : undefined,
      });
      return { total: 0, matched: 0, transient: true, resourceLimit: status === 546 };
    }
    throw err;
  }
}
