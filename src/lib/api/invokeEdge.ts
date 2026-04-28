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
import { checkBudget, trackCost } from "@/lib/api/costTracker";
import { validateResponse, type ResponseSchema } from "@/lib/api/responseValidator";
import { Sentry } from "@/lib/sentry";
import { traceCollector } from "@/v2/observability/traceCollector";

const log = createLogger("invokeEdge");

export interface InvokeEdgeOptions {
  body?: unknown;
  /** Identificativo del call-site, finisce in `details.context` di ApiError */
  context: string;
  /** Header HTTP opzionali */
  headers?: Record<string, string>;
  /** Optional runtime schema validation for the response */
  responseSchema?: ResponseSchema;
}

export async function invokeEdge<T = unknown>(
  functionName: string,
  options: InvokeEdgeOptions,
): Promise<T> {
  const { body, context, headers, responseSchema } = options;

  // Guardrail: block if session budget exceeded
  checkBudget();

  // Trace: ensure correlation id exists for this invocation
  const _traceCorr = traceCollector.getActiveCorrelationId() ?? traceCollector.startCorrelation();
  const _traceStart = Date.now();
  const _traceRoute = typeof window !== "undefined" ? window.location.pathname : undefined;

  let result: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    result = await supabase.functions.invoke(functionName, {
      body: body as Record<string, unknown> | undefined,
      headers,
    });
  } catch (err) {
    log.warn("invoke threw", { functionName, context, err });
    Sentry.addBreadcrumb({ category: "edge-function", message: `${functionName} threw`, level: "error", data: { functionName, context } });
    Sentry.captureException(err, { tags: { "edge.function": functionName } });
    traceCollector.push({
      type: "edge.invoke",
      scope: "edge",
      source: `${functionName}:${context}`,
      route: _traceRoute,
      status: "error",
      duration_ms: Date.now() - _traceStart,
      payload_summary: { functionName, context },
      error: { message: err instanceof Error ? err.message : String(err) },
      correlation_id: _traceCorr,
    });
    throw ApiError.from(err, context);
  }

  if (result.error) {
    // supabase.functions.invoke restituisce { data, error } senza throw
    // sui 4xx/5xx — convertiamo l'errore preservando lo status e — quando
    // possibile — anche il body strutturato (es. { error: "no_email" }).
    const errAny = result.error as unknown as {
      message?: string;
      context?: Response | { status?: number };
      status?: number;
      name?: string;
    };
    const ctxResponse = errAny?.context;
    const isResponse = typeof Response !== "undefined" && ctxResponse instanceof Response;
    const status = isResponse
      ? (ctxResponse as Response).status
      : (ctxResponse as { status?: number } | undefined)?.status ?? errAny?.status;

    let body: Record<string, unknown> | undefined;
    if (isResponse) {
      try {
        const cloned = (ctxResponse as Response).clone();
        body = (await cloned.json()) as Record<string, unknown>;
      } catch (e) {
        log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
        // body non-JSON o stream già consumato — best-effort
      }
    }

    const code: ApiError["code"] =
      status === 401 ? "UNAUTHENTICATED" :
      status === 403 ? "FORBIDDEN" :
      status === 404 ? "NOT_FOUND" :
      status === 422 ? "VALIDATION_FAILED" :
      status === 429 ? "RATE_LIMITED" :
      typeof status === "number" && status >= 500 ? "SERVER_ERROR" :
      "UNKNOWN_ERROR";

    const messageFromBody =
      typeof body?.message === "string" ? (body.message as string) :
      typeof body?.error === "string" ? (body.error as string) :
      undefined;

    log.warn("invoke returned error", { functionName, context, status, name: errAny?.name });
    Sentry.addBreadcrumb({ category: "edge-function", message: `${functionName} failed: ${status}`, level: "error", data: { functionName, context, status } });
    traceCollector.push({
      type: "edge.invoke",
      scope: "edge",
      source: `${functionName}:${context}`,
      route: _traceRoute,
      status: status ? String(status) : "error",
      duration_ms: Date.now() - _traceStart,
      payload_summary: { functionName, context, status },
      error: { message: messageFromBody ?? errAny?.message ?? "edge error", code, status },
      correlation_id: _traceCorr,
    });
    throw new ApiError({
      code,
      message: messageFromBody ?? errAny?.message ?? `Edge function "${functionName}" failed`,
      httpStatus: status,
      details: { context, functionName, body },
    });
  }

  const data = result.data as T;

  // Trace success
  traceCollector.push({
    type: "edge.invoke",
    scope: "edge",
    source: `${functionName}:${context}`,
    route: _traceRoute,
    status: "success",
    duration_ms: Date.now() - _traceStart,
    payload_summary: { functionName, context },
    correlation_id: _traceCorr,
  });

  // Guardrail: track cost if _debug.credits_consumed is present
  const debugInfo = (data as Record<string, unknown> | null)?._debug as
    | { credits_consumed?: number }
    | undefined;
  if (debugInfo?.credits_consumed) {
    const crossed = trackCost(functionName, debugInfo.credits_consumed);
    if (crossed) {
      log.warn("soft budget limit crossed", { functionName, context });
    }
  }

  // Guardrail: validate response shape if schema provided
  if (responseSchema) {
    validateResponse<T>(data, responseSchema);
  }

  return data;
}
