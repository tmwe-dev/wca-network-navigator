/**
 * aiGateway — wrapper centralizzato per chiamate al Lovable AI Gateway.
 *
 * Vol. II §4.4 (error handling), §10.3 (resilience patterns).
 *
 * Caratteristiche:
 *  - Retry con backoff esponenziale (3 tentativi, 1s/2s/4s + jitter)
 *  - Timeout configurabile (default 30s) via AbortController
 *  - Cascade fallback model (lista ordinata)
 *  - Error mapping standard → AiGatewayError con status discriminato
 *  - Token usage estratto e ritornato (usage object Lovable)
 *  - Allowlist modelli (rifiuta unknown / typo)
 *  - Logging strutturato JSON-line
 *
 * Uso minimo:
 *   const r = await aiChat({
 *     models: ["google/gemini-2.5-flash"],
 *     messages: [{ role: "user", content: "ciao" }],
 *   });
 *   console.log(r.content, r.usage);
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
]);

export type AiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

export type AiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export interface AiChatOptions {
  /** Lista modelli ordinata per priorità (cascade fallback). */
  models: string[];
  messages: AiMessage[];
  tools?: AiTool[];
  temperature?: number;
  max_tokens?: number;
  /** Timeout totale per ogni singolo tentativo (ms). Default 30000. */
  timeoutMs?: number;
  /** Numero massimo retry per modello su errori transient. Default 2. */
  maxRetries?: number;
  /** Override API key (di default usa LOVABLE_API_KEY env). */
  apiKey?: string;
  /** Tag opzionale per logging/correlation. */
  context?: string;
}

export interface AiChatResult {
  content: string | null;
  /** Tool calls richiesti dall'LLM, se presenti. */
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  /** Modello effettivamente usato (post-fallback). */
  modelUsed: string;
  /** Token usage. */
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** Raw message restituito dal gateway (per logging/debug). */
  raw: any;
  /** Numero tentativi consumati. */
  attempts: number;
  /** Latenza totale ms. */
  latencyMs: number;
}

export class AiGatewayError extends Error {
  constructor(
    public readonly kind:
      | "rate_limited"
      | "credits_exhausted"
      | "invalid_request"
      | "unauthorized"
      | "server_error"
      | "timeout"
      | "network"
      | "all_models_failed"
      | "no_api_key"
      | "invalid_model",
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529;
}

function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 10000);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function logLine(level: "info" | "warn" | "error", event: string, data: Record<string, unknown>): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export async function aiChat(opts: AiChatOptions): Promise<AiChatResult> {
  const startedAt = Date.now();
  const apiKey = opts.apiKey || Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new AiGatewayError("no_api_key", "LOVABLE_API_KEY not configured");
  }
  if (!opts.models.length) {
    throw new AiGatewayError("invalid_model", "models[] cannot be empty");
  }
  for (const m of opts.models) {
    if (!ALLOWED_MODELS.has(m)) {
      throw new AiGatewayError("invalid_model", `Model not allowlisted: ${m}`);
    }
  }

  const timeoutMs = opts.timeoutMs ?? 30000;
  const maxRetries = opts.maxRetries ?? 2;
  const ctx = opts.context || "aiGateway";

  let totalAttempts = 0;
  let lastError: AiGatewayError | null = null;

  for (const model of opts.models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      const t0 = Date.now();
      try {
        const body: Record<string, unknown> = {
          model,
          messages: opts.messages,
        };
        if (opts.tools) body.tools = opts.tools;
        if (opts.temperature !== undefined) body.temperature = opts.temperature;
        if (opts.max_tokens !== undefined) body.max_tokens = opts.max_tokens;

        const resp = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();
          const choice = data?.choices?.[0]?.message;
          const content: string | null = typeof choice?.content === "string" ? choice.content : null;
          const toolCalls = Array.isArray(choice?.tool_calls)
            ? choice.tool_calls.map((tc: any) => ({
                id: String(tc.id || ""),
                name: String(tc.function?.name || ""),
                arguments: String(tc.function?.arguments || "{}"),
              }))
            : [];
          const usage = {
            promptTokens: Number(data?.usage?.prompt_tokens || 0),
            completionTokens: Number(data?.usage?.completion_tokens || 0),
            totalTokens: Number(data?.usage?.total_tokens || 0),
          };
          logLine("info", "ai_gateway.success", {
            ctx, model, attempts: totalAttempts,
            latencyMs: Date.now() - t0,
            tokens: usage.totalTokens,
            toolCalls: toolCalls.length,
          });
          return {
            content,
            toolCalls,
            modelUsed: model,
            usage,
            raw: choice,
            attempts: totalAttempts,
            latencyMs: Date.now() - startedAt,
          };
        }

        // Non-OK
        const errText = await resp.text().catch(() => "");
        const status = resp.status;
        logLine("warn", "ai_gateway.non_ok", {
          ctx, model, attempt, status,
          snippet: errText.substring(0, 200),
        });

        if (status === 401 || status === 403) {
          throw new AiGatewayError("unauthorized", "Gateway auth failed", status, errText);
        }
        if (status === 429) {
          lastError = new AiGatewayError("rate_limited", "Rate limited by gateway", status, errText);
          // Retry-able: continue attempt loop
        } else if (status === 402) {
          throw new AiGatewayError("credits_exhausted", "AI credits exhausted", status, errText);
        } else if (status === 400 || status === 422) {
          // Don't retry malformed requests, but allow next model
          lastError = new AiGatewayError("invalid_request", `Bad request (${status})`, status, errText);
          break;
        } else if (isRetryableStatus(status)) {
          lastError = new AiGatewayError("server_error", `Server error (${status})`, status, errText);
        } else {
          lastError = new AiGatewayError("server_error", `Unhandled status ${status}`, status, errText);
          break;
        }

        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
        }
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof AiGatewayError) throw err;
        const isAbort = (err as any)?.name === "AbortError";
        if (isAbort) {
          lastError = new AiGatewayError("timeout", `Timeout after ${timeoutMs}ms`);
          logLine("warn", "ai_gateway.timeout", { ctx, model, attempt, timeoutMs });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          lastError = new AiGatewayError("network", msg);
          logLine("warn", "ai_gateway.network", { ctx, model, attempt, error: msg });
        }
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
        }
      }
    }
    // try next model in cascade
  }

  logLine("error", "ai_gateway.all_failed", {
    ctx, models: opts.models, attempts: totalAttempts,
    lastError: lastError?.kind,
  });
  throw lastError ?? new AiGatewayError("all_models_failed", "All models exhausted");
}

/** Convenience: extract just the text content for simple completions. */
export async function aiComplete(opts: AiChatOptions): Promise<string | null> {
  const r = await aiChat(opts);
  return r.content;
}

/** Map AiGatewayError → HTTP Response with safe payload. */
export function mapErrorToResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  if (err instanceof AiGatewayError) {
    const statusMap: Record<AiGatewayError["kind"], number> = {
      rate_limited: 429,
      credits_exhausted: 402,
      invalid_request: 400,
      unauthorized: 401,
      server_error: 502,
      timeout: 504,
      network: 502,
      all_models_failed: 502,
      no_api_key: 500,
      invalid_model: 400,
    };
    return new Response(
      JSON.stringify({ error: err.kind, message: err.message }),
      { status: statusMap[err.kind] ?? 500, headers },
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new Response(JSON.stringify({ error: "internal", message: msg }), { status: 500, headers });
}
