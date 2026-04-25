import "../_shared/llmFetchInterceptor.ts";
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

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
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

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("[ai-gateway-micro] LOVABLE_API_KEY missing");
    return jsonResponse({ error: "server_misconfigured" }, 500, origin);
  }

  const startedAt = Date.now();
  try {
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: parsed.model,
        messages: [
          { role: "system", content: parsed.system },
          { role: "user", content: parsed.user },
        ],
        max_tokens: parsed.max_tokens,
        temperature: parsed.temperature,
        stream: false,
      }),
    });

    if (upstream.status === 429) {
      return jsonResponse(
        { error: "rate_limited", message: "Troppe richieste, riprova tra poco." },
        429,
        origin,
      );
    }
    if (upstream.status === 402) {
      return jsonResponse(
        {
          error: "payment_required",
          message: "Crediti Lovable AI esauriti. Aggiungi crediti in Settings → Workspace → Usage.",
        },
        402,
        origin,
      );
    }
    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("[ai-gateway-micro] gateway error", upstream.status, text.slice(0, 500));
      return jsonResponse(
        { error: "gateway_error", status: upstream.status },
        502,
        origin,
      );
    }

    const json = await upstream.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      console.error(
        "[ai-gateway-micro] empty content",
        JSON.stringify(json).slice(0, 500),
      );
      return jsonResponse(
        { error: "empty_response", finish_reason: json?.choices?.[0]?.finish_reason },
        502,
        origin,
      );
    }

    return jsonResponse(
      {
        content,
        model: parsed.model,
        usage: json?.usage ?? null,
        latency_ms: Date.now() - startedAt,
      },
      200,
      origin,
    );
  } catch (err) {
    console.error("[ai-gateway-micro] exception", err);
    return jsonResponse(
      { error: "internal_error", message: err instanceof Error ? err.message : "unknown" },
      500,
      origin,
    );
  }
});
