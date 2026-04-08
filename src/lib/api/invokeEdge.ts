/**
 * invokeEdge — wrapper centralizzato per supabase.functions.invoke.
 *
 * Vol. II §5.3: tutti gli errori delle Edge Functions devono essere
 * normalizzati a `ApiError` con discriminator `code`, così i call-site
 * possono fare branching senza parsare stringhe.
 *
 * Pattern strangler (Vol. II §16.7 + ADR-0001): non rompiamo i 45
 * call-site esistenti che usano direttamente `supabase.functions.invoke`.
 * Il nuovo codice (e le migrazioni incrementali) deve passare di qui.
 *
 * Esempio:
 *   const data = await invokeEdge<MyResult>("scrape-wca-directory", {
 *     body: { countryCode, network },
 *     context: "scanDirectory",
 *   });
 */
import { supabase } from "@/integrations/supabase/client";
import { ApiError } from "@/lib/api/apiError";
import { createLogger } from "@/lib/log";

const log = createLogger("invokeEdge");

export interface InvokeEdgeOptions {
  body?: unknown;
  /** Identificativo del call-site, finisce in `details.context` di ApiError */
  context: string;
  /** Header HTTP opzionali */
  headers?: Record<string, string>;
}

export async function invokeEdge<T = unknown>(
  functionName: string,
  options: InvokeEdgeOptions,
): Promise<T> {
  const { body, context, headers } = options;

  let result: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    result = await supabase.functions.invoke(functionName, {
      body: body as Record<string, unknown> | undefined,
      headers,
    });
  } catch (err) {
    log.warn("invoke threw", { functionName, context, err });
    throw ApiError.from(err, context);
  }

  if (result.error) {
    // supabase.functions.invoke restituisce { data, error } senza throw
    // sui 4xx/5xx — convertiamo l'errore preservando lo status quando
    // disponibile sull'oggetto FunctionsHttpError.
    const errAny = result.error as unknown as {
      message?: string;
      context?: { status?: number };
      status?: number;
      name?: string;
    };
    const status = errAny?.context?.status ?? errAny?.status;
    log.warn("invoke returned error", { functionName, context, status, name: errAny?.name });
    throw new ApiError({
      code:
        status === 401 ? "UNAUTHENTICATED" :
        status === 403 ? "FORBIDDEN" :
        status === 404 ? "NOT_FOUND" :
        status === 422 ? "VALIDATION_FAILED" :
        status === 429 ? "RATE_LIMITED" :
        typeof status === "number" && status >= 500 ? "SERVER_ERROR" :
        "UNKNOWN_ERROR",
      message: errAny?.message ?? `Edge function "${functionName}" failed`,
      httpStatus: status,
      details: { context, functionName },
    });
  }

  return result.data as T;
}
