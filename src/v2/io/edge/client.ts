/**
 * Edge Function Client v2 — Result-based with Zod validation
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../core/domain/errors";
import { withCircuitBreaker } from "../../bridge/circuit-breaker";
import type { z } from "zod";

/**
 * Invokes a Supabase edge function with Result wrapping,
 * Zod response validation, and circuit breaker protection.
 */
export async function invokeEdgeV2<TReq extends Record<string, unknown>, TRes>(
  functionName: string,
  payload: TReq,
  responseSchema: z.ZodType<TRes>,
): Promise<Result<TRes, AppError>> {
  return withCircuitBreaker(
    `edge:${functionName}`,
    async () => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      if (error) {
        throw new Error(`Edge function "${functionName}" failed: ${error.message}`);
      }

      const parsed = responseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Edge function "${functionName}" response schema mismatch: ${parsed.error.message}`,
        );
      }

      return parsed.data;
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
      return err(ioError("EDGE_FUNCTION_ERROR", error.message, {
        functionName,
      }, "invokeEdgeRaw"));
    }

    return ok(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "EDGE_FUNCTION_ERROR", `invokeEdgeRaw:${functionName}`));
  }
}
