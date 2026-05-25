/**
 * aiCallShim — drop-in replacement per `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", ...)`.
 *
 * Rispetta `AI_PROVIDER` env var:
 *  - "openai"   → routa su https://api.openai.com con OPENAI_API_KEY
 *  - "anthropic"→ routa su Anthropic con ANTHROPIC_API_KEY
 *  - "google"   → routa su Google AI con GEMINI_API_KEY
 *  - default    → fallback su gateway Lovable con LOVABLE_API_KEY
 *
 * Mappa automaticamente i modelli (gemini-flash → gpt-4o-mini, ecc.) e rimuove
 * campi non supportati dal provider scelto (es. `reasoning` su OpenAI classico).
 *
 * Firma identica a fetch() per essere drop-in: chiamare `aiFetch(body)` e usare
 * la Response esattamente come prima (incluso response.body per streaming SSE).
 */

import { MODEL_MAP, PROVIDER_CONFIG, type ProviderKey } from "./aiGatewayConfig.ts";

function resolveProvider(): ProviderKey {
  const raw = (Deno.env.get("AI_PROVIDER") || "").trim().toLowerCase();
  if (raw === "openai" && Deno.env.get("OPENAI_API_KEY")) return "openai";
  if (raw === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) return "anthropic";
  if (raw === "google" && Deno.env.get("GEMINI_API_KEY")) return "google";
  if (raw === "openrouter" && Deno.env.get("OPENROUTER_API_KEY")) return "openrouter";
  if (raw === "grok" && Deno.env.get("GROK_API_KEY")) return "grok";
  if (raw === "qwen" && Deno.env.get("QWEN_API_KEY")) return "qwen";

  if (Deno.env.get("OPENAI_API_KEY")) return "openai";
  if (Deno.env.get("GEMINI_API_KEY")) return "google";
  if (Deno.env.get("ANTHROPIC_API_KEY")) return "anthropic";
  if (Deno.env.get("OPENROUTER_API_KEY")) return "openrouter";
  if (Deno.env.get("GROK_API_KEY")) return "grok";
  if (Deno.env.get("QWEN_API_KEY")) return "qwen";
  return "lovable";
}

function mapModel(provider: ProviderKey, requested: string | undefined): string | undefined {
  if (!requested) return requested;
  const map = MODEL_MAP[provider] || {};
  return map[requested] || requested;
}

/** Rimuove campi che alcuni provider rifiutano. */
function sanitizeBody(provider: ProviderKey, body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if (provider === "openai") {
    // OpenAI non accetta `reasoning` object (solo modelli o1/o3 specifici)
    if (out.reasoning && typeof out.reasoning === "object") delete out.reasoning;
    if ("safety_settings" in out) delete out.safety_settings;
  }
  if (provider === "google") {
    if ("reasoning" in out) delete out.reasoning;
  }
  return out;
}

/**
 * Drop-in per fetch al gateway AI.
 * @param body payload chat-completions (model, messages, tools, stream, ...)
 * @param init opzionale: AbortSignal, headers extra
 */
export async function aiFetch(
  body: Record<string, unknown>,
  init?: { signal?: AbortSignal; headers?: Record<string, string> }
): Promise<Response> {
  const provider = resolveProvider();
  const cfg = PROVIDER_CONFIG[provider];
  const apiKey = Deno.env.get(cfg.envKey);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `${cfg.envKey} non configurata` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const patched = sanitizeBody(provider, body);
  if (typeof patched.model === "string") {
    patched.model = mapModel(provider, patched.model);
  }

  return fetch(cfg.url, {
    method: "POST",
    signal: init?.signal,
    headers: {
      Authorization: cfg.authHeader(apiKey),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: JSON.stringify(patched),
  });
}

/** Compat alias. */
export const aiGatewayFetch = aiFetch;