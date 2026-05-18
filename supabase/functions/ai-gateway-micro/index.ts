/**
 * ai-gateway-micro — Endpoint minimale per micro-call AI dell'Armonizzatore V2.
 *
 * BYPASSA: context assembly, doctrine, memoria, tool, scope config, fallback chain.
 * Una sola call diretta al Lovable AI Gateway.
 *
 * Sicurezza: JWT verify (requireAuth), CORS dinamico, security headers.
 * Input: { system, user, model, max_tokens, temperature }
 * Output: { content: string, model: string, usage: {...} }
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { aiChat, AiGatewayError } from "../_shared/aiGateway.ts";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const ALLOWED_MODELS = new Set([
  // Logical (mapped via MODEL_MAP)
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  // Native names (post-migration)
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-5",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
]);

const RequestSchema = z.object({
  system: z.string().min(1).max(8000),
  user: z.string().min(1).max(20000),
  model: z.string().refine((m) => ALLOWED_MODELS.has(m), {
    message: "model not in allowlist",
  }).default("google/gemini-2.5-flash"),
  max_tokens: z.number().int().min(64).max(8192).default(1024),
  temperature: z.number().min(0).max(2).default(0.1),
});

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405, origin);
  }

  // Auth obbligatoria.
  const auth = await requireAuth(req, { ...corsHeaders, ...SECURITY_HEADERS });
  if (isAuthError(auth)) return auth;

  // Validazione body.
  let parsed: z.infer<typeof RequestSchema>;
  try {
    const raw = await req.json();
    const result = RequestSchema.safeParse(raw);
    if (!result.success) {
      return jsonResponse(
        { error: "invalid_input", details: result.error.flatten() },
        400,
        origin,
      );
    }
    parsed = result.data;
  } catch (_e) {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }

  const startedAt = Date.now();
  try {
    const result = await aiChat({
      models: [parsed.model],
      messages: [
        { role: "system", content: parsed.system },
        { role: "user", content: parsed.user },
      ],
      max_tokens: parsed.max_tokens,
      temperature: parsed.temperature,
      scope: "ai_gateway_micro",
      functionName: "ai-gateway-micro",
      userId: auth.userId,
    });
    if (!result.content || result.content.length === 0) {
      return jsonResponse({ error: "empty_response" }, 502, origin);
    }
    return jsonResponse(
      {
        content: result.content,
        model: result.modelUsed,
        usage: {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: result.usage.totalTokens,
        },
        latency_ms: Date.now() - startedAt,
      },
      200,
      origin,
    );
  } catch (err) {
    if (err instanceof AiGatewayError) {
      const statusMap: Record<string, number> = {
        rate_limited: 429,
        credits_exhausted: 402,
        unauthorized: 401,
        invalid_request: 400,
        timeout: 504,
      };
      const status = statusMap[err.kind] ?? 502;
      return jsonResponse({ error: err.kind, message: err.message }, status, origin);
    }
    console.error("[ai-gateway-micro] exception", err);
    return jsonResponse(
      { error: "internal_error", message: err instanceof Error ? err.message : "unknown" },
      500,
      origin,
    );
  }
});
