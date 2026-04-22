/**
 * aiGatewayTypes — Types, interfaces, error class, and internal utilities
 * for the AI Gateway.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
  /** User ID for token tracking (optional). */
  userId?: string;
  /** Function name for token tracking (optional). */
  functionName?: string;
  /** Supabase client for token logging (optional). */
  supabase?: SupabaseClient;
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

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export type AiGatewayErrorKind =
  | "rate_limited"
  | "credits_exhausted"
  | "invalid_request"
  | "unauthorized"
  | "server_error"
  | "timeout"
  | "network"
  | "all_models_failed"
  | "no_api_key"
  | "invalid_model";

export class AiGatewayError extends Error {
  constructor(
    public readonly kind: AiGatewayErrorKind,
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529;
}

export function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 10000);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function logLine(level: "info" | "warn" | "error", event: string, data: Record<string, unknown>): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// ---------------------------------------------------------------------------
// Anthropic adapter
// ---------------------------------------------------------------------------

export interface AnthropicBody {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  tools?: AiTool[];
}

export function buildAnthropicBody(
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

export function parseAnthropicResponse(data: AnthropicResponseData): {
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

/** Map AiGatewayError → HTTP Response with safe payload. */
export function mapErrorToResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  if (err instanceof AiGatewayError) {
    const statusMap: Record<AiGatewayErrorKind, number> = {
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
