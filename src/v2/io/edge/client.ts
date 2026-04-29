/**
 * Edge Function Client v2 — Result-based with Zod validation
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../core/domain/errors";
import { withCircuitBreaker } from "../../bridge/circuit-breaker";
import { traceCollector } from "../observability/traceCollector";
import type { z } from "zod";

/**
 * Translates raw Supabase invoke errors into user-facing messages.
 * The supabase-js SDK throws "Failed to send a request to the Edge Function"
 * whenever the underlying fetch crashes — most often CORS/preflight/network,
 * not necessarily auth. Keep the message diagnostic instead of blaming login.
 */
function translateInvokeError(functionName: string, rawMessage: string): string {
  const msg = (rawMessage ?? "").toLowerCase();

  if (
    msg.includes("failed to send a request") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed")
  ) {
    return `Connessione interrotta verso "${functionName}". Possibile blocco CORS/preflight o rete: apri Trace Console e riprova.`;
  }

  if (msg.includes("401") || msg.includes("unauthor") || msg.includes("jwt")) {
    return `Sessione non valida per "${functionName}". Effettua di nuovo il login.`;
  }

  if (msg.includes("429") || msg.includes("rate limit")) {
    return `Troppe richieste verso "${functionName}". Attendi qualche secondo e riprova.`;
  }

  if (msg.includes("402") || msg.includes("payment")) {
    return `Crediti AI esauriti per "${functionName}". Aggiungi crediti dal pannello workspace.`;
  }

  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
    return `Errore temporaneo del motore "${functionName}". Riprova tra qualche secondo.`;
  }

  return `Edge function "${functionName}" failed: ${rawMessage}`;
}

/**
 * Invokes a Supabase edge function with Result wrapping,
 * Zod response validation, and circuit breaker protection.
 */
export async function invokeEdgeV2<TReq extends Record<string, unknown>, TRes>(
  functionName: string,
  payload: TReq,
  responseSchema: z.ZodType<TRes>,
): Promise<Result<TRes, AppError>> {
  const activeCorrelation = traceCollector.getActiveCorrelationId();
  const correlationId = activeCorrelation ?? traceCollector.startCorrelation();
  const ownsCorrelation = !activeCorrelation;
  const startedAt = Date.now();
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;

  return withCircuitBreaker(
    `edge:${functionName}`,
    async () => {
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: payload,
        });

        if (error) {
          throw new Error(translateInvokeError(functionName, error.message ?? String(error)));
        }

        const parsed = responseSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error(
            `Edge function "${functionName}" response schema mismatch: ${parsed.error.message}`,
          );
        }

        traceCollector.push({
          type: "edge.invoke",
          scope: typeof payload.scope === "string" ? payload.scope : "edge",
          source: `${functionName}:invokeEdgeV2`,
          route,
          status: "success",
          duration_ms: Date.now() - startedAt,
          payload_summary: { functionName, request: payload },
          correlation_id: correlationId,
        });
        return parsed.data;
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : String(caught);
        traceCollector.push({
          type: "edge.invoke",
          scope: typeof payload.scope === "string" ? payload.scope : "edge",
          source: `${functionName}:invokeEdgeV2`,
          route,
          status: "error",
          duration_ms: Date.now() - startedAt,
          payload_summary: { functionName, request: payload },
          error: { message },
          correlation_id: correlationId,
        });
        throw caught;
      } finally {
        if (ownsCorrelation) traceCollector.endCorrelation(correlationId);
      }
    },
  );
}

/**
 * Invokes an edge function without response schema validation.
 * Use when the response shape is unknown or unimportant.
 */
export async function invokeEdgeRaw<TReq extends Record<string, unknown>>(
  functionName: string,
  payload: TReq,
): Promise<Result<unknown, AppError>> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });

    if (error) {
      return err(ioError("EDGE_FUNCTION_ERROR", translateInvokeError(functionName, error.message), {
        functionName,
      }, "invokeEdgeRaw"));
    }

    return ok(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "EDGE_FUNCTION_ERROR", `invokeEdgeRaw:${functionName}`));
  }
}
