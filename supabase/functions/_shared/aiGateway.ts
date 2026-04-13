/**
 * aiGateway — wrapper centralizzato per chiamate AI multi-provider.
 *
 * Vol. II §4.4 (error handling), §10.3 (resilience patterns).
 *
 * Caratteristiche:
 *  - Multi-provider: Lovable, OpenRouter, OpenAI, Anthropic, Google, Grok, Qwen
 *  - Retry con backoff esponenziale (3 tentativi, 1s/2s/4s + jitter)
 *  - Timeout configurabile (default 30s) via AbortController
 *  - Cascade fallback model (lista ordinata)
 *  - Error mapping standard → AiGatewayError con status discriminato
 *  - Token usage estratto e ritornato (usage object normalizzato)
 *  - Logging strutturato JSON-line
 *
 * Uso minimo:
 *   const r = await aiChat({
 *     models: ["google/gemini-2.5-flash"],
 *     messages: [{ role: "user", content: "ciao" }],
 *   });
 *   console.log(r.content, r.usage);
 */

// Multi-provider AI Gateway. Configura via env vars:
// AI_PROVIDER: "lovable" | "openrouter" | "openai" | "anthropic" | "google" | "grok" | "qwen" (default: "lovable")
// AI_API_KEY: chiave per il provider selezionato (fallback: LOVABLE_API_KEY)
// AI_GATEWAY_URL: override URL completo (opzionale, sovrascrive il provider)

type ProviderKey = "lovable" | "openrouter" | "openai" | "anthropic" | "google" | "grok" | "qwen";

interface ProviderEntry {
  url: string;
  authHeader: (key: string) => string;
}

const PROVIDER_CONFIG: Record<ProviderKey, ProviderEntry> = {
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    authHeader: (key) => key, // used via x-api-key header
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  grok: {
    url: "https://api.x.ai/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
  qwen: {
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    authHeader: (key) => "Bearer " + key,
  },
};

const MODEL_MAP: Record<string, Record<string, string>> = {
  lovable: {},    // pass-through
  openrouter: {}, // pass-through
  openai: {
    "openai/gpt-5-mini": "gpt-4o-mini",
    "openai/gpt-5": "gpt-4o",
    "openai/gpt-5-nano": "gpt-4o-mini",
    "google/gemini-2.5-flash": "gpt-4o-mini",
    "google/gemini-2.5-flash-lite": "gpt-4o-mini",
    "google/gemini-3-flash-preview": "gpt-4o",
  },
  anthropic: {
    "google/gemini-3-flash-preview": "claude-sonnet-4-20250514",
    "openai/gpt-5": "claude-sonnet-4-20250514",
    "google/gemini-2.5-flash": "claude-haiku-4-20250514",
    "google/gemini-2.5-flash-lite": "claude-haiku-4-20250514",
    "openai/gpt-5-mini": "claude-haiku-4-20250514",
    "openai/gpt-5-nano": "claude-haiku-4-20250514",
  },
  google: {
    "google/gemini-2.5-flash": "gemini-2.5-flash",
    "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "google/gemini-3-flash-preview": "gemini-2.5-flash",
    "openai/gpt-5": "gemini-2.5-flash",
    "openai/gpt-5-mini": "gemini-2.5-flash-lite",
    "openai/gpt-5-nano": "gemini-2.5-flash-lite",
  },
  grok: {
    "google/gemini-2.5-flash": "grok-3-mini-fast",
    "google/gemini-2.5-flash-lite": "grok-3-mini-fast",
    "google/gemini-3-flash-preview": "grok-3-mini-fast",
    "openai/gpt-5": "grok-3-mini-fast",
    "openai/gpt-5-mini": "grok-3-mini-fast",
    "openai/gpt-5-nano": "grok-3-mini-fast",
  },
  qwen: {
    "google/gemini-3-flash-preview": "qwen-plus",
    "openai/gpt-5": "qwen-plus",
    "google/gemini-2.5-flash": "qwen-turbo",
    "google/gemini-2.5-flash-lite": "qwen-turbo",
    "openai/gpt-5-mini": "qwen-turbo",
    "openai/gpt-5-nano": "qwen-turbo",
  },
};

/** Known Lovable-style model names (kept for backward compat, now warning-only). */
export const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "openai/gpt-5-nano",
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
  /** Override API key (di default usa AI_API_KEY / LOVABLE_API_KEY env). */
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
  raw: Record<string, unknown>;
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Anthropic helpers
// ---------------------------------------------------------------------------

interface AnthropicBody {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  tools?: AiTool[];
}

function buildAnthropicBody(
  model: string,
  messages: AiMessage[],
  opts: AiChatOptions,
): AnthropicBody {
  let systemText: string | undefined;
  const filtered: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemText = (systemText ? systemText + "\n" : "") + m.content;
    } else {
      filtered.push({ role: m.role, content: m.content });
    }
  }
  const body: AnthropicBody = {
    model,
    max_tokens: opts.max_tokens || 4096,
    messages: filtered,
  };
  if (systemText) body.system = systemText;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.tools) body.tools = opts.tools;
  return body;
}

interface AnthropicResponseData {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function parseAnthropicResponse(data: AnthropicResponseData): {
  content: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  raw: Record<string, unknown>;
} {
  const textBlock = data.content?.find((b) => b.type === "text");
  const content = textBlock?.text ?? null;
  const promptTokens = Number(data.usage?.input_tokens || 0);
  const completionTokens = Number(data.usage?.output_tokens || 0);
  return {
    content,
    toolCalls: [],
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    raw: data as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type ToolCallRaw = { id?: string; function?: { name?: string; arguments?: string } };

export async function aiChat(opts: AiChatOptions): Promise<AiChatResult> {
  const startedAt = Date.now();

  // Resolve provider
  const provider = (Deno.env.get("AI_PROVIDER") || "lovable") as string;
  const config = PROVIDER_CONFIG[provider as ProviderKey] || PROVIDER_CONFIG.lovable;
  const gatewayUrl = Deno.env.get("AI_GATEWAY_URL") || config.url;
  const apiKey = opts.apiKey || Deno.env.get("AI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");

  if (!apiKey) {
    throw new AiGatewayError("no_api_key", "AI_API_KEY not configured (set AI_API_KEY or LOVABLE_API_KEY)");
  }
  if (!opts.models.length) {
    throw new AiGatewayError("invalid_model", "models[] cannot be empty");
  }

  // Warn on unknown models instead of throwing
  for (const m of opts.models) {
    if (!ALLOWED_MODELS.has(m)) {
      logLine("warn", "ai_gateway.unknown_model", { model: m, hint: "Model not in ALLOWED_MODELS set, proceeding anyway" });
    }
  }

  const isAnthropic = provider === "anthropic";
  const timeoutMs = opts.timeoutMs ?? 30000;
  const maxRetries = opts.maxRetries ?? 2;
  const ctx = opts.context || "aiGateway";

  let totalAttempts = 0;
  let lastError: AiGatewayError | null = null;

  for (const model of opts.models) {
    const nativeModel = MODEL_MAP[provider]?.[model] || model;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      const t0 = Date.now();
      try {
        // Build request body
        let bodyStr: string;
        if (isAnthropic) {
          bodyStr = JSON.stringify(buildAnthropicBody(nativeModel, opts.messages, opts));
        } else {
          const body: Record<string, unknown> = {
            model: nativeModel,
            messages: opts.messages,
          };
          if (opts.tools) body.tools = opts.tools;
          if (opts.temperature !== undefined) body.temperature = opts.temperature;
          if (opts.max_tokens !== undefined) body.max_tokens = opts.max_tokens;
          bodyStr = JSON.stringify(body);
        }

        // Build headers
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (isAnthropic) {
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
        } else {
          headers["Authorization"] = config.authHeader(apiKey);
        }

        const resp = await fetch(gatewayUrl, {
          method: "POST",
          headers,
          body: bodyStr,
          signal: ac.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();

          let content: string | null;
          let toolCalls: Array<{ id: string; name: string; arguments: string }>;
          let usage: { promptTokens: number; completionTokens: number; totalTokens: number };
          let raw: Record<string, unknown>;

          if (isAnthropic) {
            const parsed = parseAnthropicResponse(data as AnthropicResponseData);
            content = parsed.content;
            toolCalls = parsed.toolCalls;
            usage = parsed.usage;
            raw = parsed.raw;
          } else {
            const choice = data?.choices?.[0]?.message;
            content = typeof choice?.content === "string" ? choice.content : null;
            toolCalls = Array.isArray(choice?.tool_calls)
              ? choice.tool_calls.map((tc: ToolCallRaw) => ({
                  id: String(tc.id || ""),
                  name: String(tc.function?.name || ""),
                  arguments: String(tc.function?.arguments || "{}"),
                }))
              : [];
            usage = {
              promptTokens: Number(data?.usage?.prompt_tokens || 0),
              completionTokens: Number(data?.usage?.completion_tokens || 0),
              totalTokens: Number(data?.usage?.total_tokens || 0),
            };
            raw = (choice ?? {}) as Record<string, unknown>;
          }

          logLine("info", "ai_gateway.success", {
            ctx, provider, model, nativeModel, attempts: totalAttempts,
            latencyMs: Date.now() - t0,
            tokens: usage.totalTokens,
            toolCalls: toolCalls.length,
          });
          return {
            content,
            toolCalls,
            modelUsed: model,
            usage,
            raw,
            attempts: totalAttempts,
            latencyMs: Date.now() - startedAt,
          };
        }

        // Non-OK
        const errText = await resp.text().catch(() => "");
        const status = resp.status;
        logLine("warn", "ai_gateway.non_ok", {
          ctx, provider, model, attempt, status,
          snippet: errText.substring(0, 200),
        });

        if (status === 401 || status === 403) {
          throw new AiGatewayError("unauthorized", "Gateway auth failed", status, errText);
        }
        if (status === 429) {
          lastError = new AiGatewayError("rate_limited", "Rate limited by gateway", status, errText);
        } else if (status === 402) {
          throw new AiGatewayError("credits_exhausted", "AI credits exhausted", status, errText);
        } else if (status === 400 || status === 422) {
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
        const isAbort = err instanceof Error && err.name === "AbortError";
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
    ctx, provider, models: opts.models, attempts: totalAttempts,
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
