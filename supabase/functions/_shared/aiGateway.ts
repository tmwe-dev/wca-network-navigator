/**
 * aiGateway — wrapper centralizzato per chiamate AI multi-provider.
 *
 * Split in 3 moduli:
 *  - aiGatewayConfig.ts  → Provider config, model mapping, allowed models
 *  - aiGatewayTypes.ts   → Types, error class, Anthropic adapter, utilities
 *  - aiGateway.ts        → Core aiChat logic (questo file)
 *
 * Uso minimo:
 *   const r = await aiChat({
 *     models: ["google/gemini-2.5-flash"],
 *     messages: [{ role: "user", content: "ciao" }],
 *   });
 *   // r.content and r.usage contain the response
 */

import { PROVIDER_CONFIG, MODEL_MAP, ALLOWED_MODELS, type ProviderKey } from "./aiGatewayConfig.ts";
import { createLogger } from "./structuredLogger.ts";
import { resolveScopeRoute } from "./aiScopeRouter.ts";
import {
  AiGatewayError,
  isRetryableStatus,
  backoffMs,
  sleep,
  logLine,
  buildAnthropicBody,
  parseAnthropicResponse,
  mapErrorToResponse,
  type AiChatOptions,
  type AiChatResult,
  type AiMessage,
  type AiTool,
  type AiGatewayErrorKind,
} from "./aiGatewayTypes.ts";

// Re-export everything for backward compatibility
export { ALLOWED_MODELS } from "./aiGatewayConfig.ts";
export {
  AiGatewayError,
  mapErrorToResponse,
  type AiMessage,
  type AiTool,
  type AiChatOptions,
  type AiChatResult,
  type AiGatewayErrorKind,
} from "./aiGatewayTypes.ts";

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

type ToolCallRaw = { id?: string; function?: { name?: string; arguments?: string } };

const USER_PROVIDER_PRIORITY: readonly ProviderKey[] = ["openai", "google", "anthropic", "openrouter", "grok", "qwen"];

function normalizeProviderKey(raw: unknown): ProviderKey | null {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return value in PROVIDER_CONFIG ? (value as ProviderKey) : null;
}

function hasProviderKey(provider: ProviderKey): boolean {
  return Boolean(Deno.env.get(PROVIDER_CONFIG[provider].envKey));
}

function firstConfiguredUserProvider(preferred?: ProviderKey | null): ProviderKey | null {
  if (preferred && preferred !== "lovable" && hasProviderKey(preferred)) return preferred;
  return USER_PROVIDER_PRIORITY.find((provider) => hasProviderKey(provider)) ?? null;
}

export async function aiChat(opts: AiChatOptions): Promise<AiChatResult> {
  const startedAt = Date.now();
  const metricsLog = createLogger(opts.functionName ?? opts.context ?? "ai_gateway", {
    userId: opts.userId ?? null,
    scope: opts.scope ?? null,
  });

  // ---------------------------------------------------------------------------
  // Resolve provider — priority:
  //   1. DB routing per scope (ai_routing_config) — overrides everything
  //   2. AI_PROVIDER env var (legacy/global override)
  //   3. "anthropic" default (post-Lovable migration)
  // ---------------------------------------------------------------------------
  const scopeRoute = await resolveScopeRoute(opts.scope);
  const routeProvider = normalizeProviderKey(scopeRoute?.provider);
  const envProvider = normalizeProviderKey(Deno.env.get("AI_PROVIDER"));
  const provider: ProviderKey =
    firstConfiguredUserProvider(routeProvider) ||
    firstConfiguredUserProvider(envProvider) ||
    "lovable";
  const config = PROVIDER_CONFIG[provider];
  const gatewayUrl = Deno.env.get("AI_GATEWAY_URL") || config.url;
  // Per-provider env key (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, …).
  // Fallback chain: explicit opts.apiKey → provider-specific env → legacy AI_API_KEY → LOVABLE_API_KEY solo su provider Lovable.
  const apiKey =
    opts.apiKey ||
    Deno.env.get(config.envKey) ||
    Deno.env.get("AI_API_KEY") ||
    (provider === "lovable" ? Deno.env.get("LOVABLE_API_KEY") : undefined);

  if (!apiKey) {
    throw new AiGatewayError(
      "no_api_key",
      `${config.envKey} not configured for provider '${provider}'`,
    );
  }
  if (!opts.models.length) {
    throw new AiGatewayError("invalid_model", "models[] cannot be empty");
  }

  // If DB scope route provides a concrete model, prepend it so it wins over fallbacks.
  const modelChain = scopeRoute?.model
    ? [scopeRoute.model, ...opts.models.filter((m) => m !== scopeRoute.model)]
    : opts.models;

  for (const m of modelChain) {
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

  for (const model of modelChain) {
    const nativeModel = MODEL_MAP[provider]?.[model] || model;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      const t0 = Date.now();
      try {
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
          if (opts.presence_penalty !== undefined) body.presence_penalty = opts.presence_penalty;
          if (opts.frequency_penalty !== undefined) body.frequency_penalty = opts.frequency_penalty;
          if (opts.seed !== undefined) body.seed = opts.seed;
          if (opts.top_p !== undefined) body.top_p = opts.top_p;
          bodyStr = JSON.stringify(body);
        }

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
            const parsed = parseAnthropicResponse(data);
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
          metricsLog.metric("ai_call", {
            duration_ms: Date.now() - startedAt,
            status_code: 200,
            tags: ["ai", provider, model, "ok"],
            provider, model, nativeModel,
            tokens_in: usage.promptTokens,
            tokens_out: usage.completionTokens,
            attempts: totalAttempts,
            tool_calls: toolCalls.length,
          });
          // Best-effort flush, never blocks response on failure.
          await metricsLog.flush().catch(() => undefined);

          // Log token usage if tracking context provided
          if (opts.supabase && opts.userId && opts.functionName) {
            try {
              const { logTokenUsage } = await import("./tokenLogger.ts");
              await logTokenUsage(
                opts.supabase,
                opts.userId,
                opts.functionName,
                nativeModel,
                usage.promptTokens,
                usage.completionTokens,
                0
              );
            } catch (tokenErr) {
              logLine("warn", "ai_gateway.token_logging_failed", {
                ctx,
                userId: opts.userId,
                functionName: opts.functionName,
                error: tokenErr instanceof Error ? tokenErr.message : String(tokenErr),
              });
            }
          }

          // Granular log on ai_prompt_log (auto-instrumenting: creates a service-role
          // client if none provided, so EVERY aiChat call is tracked).
          if (opts.functionName ?? opts.context) {
            try {
              const { logAiPrompt } = await import("./tokenLogger.ts");
              let supa = opts.supabase;
              if (!supa) {
                const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
                const url = Deno.env.get("SUPABASE_URL");
                const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
                if (url && serviceKey) {
                  supa = createClient(url, serviceKey, { auth: { persistSession: false } });
                }
              }
              if (!supa) throw new Error("no supabase client available for logging");
              const sysChars = opts.messages
                .filter((m) => m.role === "system")
                .reduce((s, m) => s + (m.content?.length ?? 0), 0);
              const userChars = opts.messages
                .filter((m) => m.role === "user")
                .reduce((s, m) => s + (m.content?.length ?? 0), 0);
              const otherChars = opts.messages
                .filter((m) => m.role !== "system" && m.role !== "user")
                .reduce((s, m) => s + (m.content?.length ?? 0), 0);
              const { estimateCostUsd } = await import("./llmPricing.ts");
              const costUsd = estimateCostUsd(nativeModel, usage.promptTokens, usage.completionTokens);
              await logAiPrompt(supa, {
                userId: opts.userId ?? null,
                operatorId: opts.operatorId ?? null,
                functionName: opts.functionName ?? opts.context ?? "unknown",
                provider,
                model: nativeModel,
                scope: opts.scope ?? null,
                action: opts.action ?? null,
                groupCategory: opts.groupCategory ?? (opts.isCron ? "cron" : "user"),
                isCron: opts.isCron ?? false,
                cronJobName: opts.cronJobName ?? null,
                tokensIn: usage.promptTokens,
                tokensOut: usage.completionTokens,
                costUsd,
                latencyMs: Date.now() - startedAt,
                systemPromptChars: sysChars,
                userPromptChars: userChars,
                contextChars: otherChars,
                success: true,
              });
            } catch (e) {
              logLine("warn", "ai_gateway.prompt_log_failed", {
                ctx,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

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

        // Non-OK response handling
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
  }

  logLine("error", "ai_gateway.all_failed", {
    ctx, provider, models: modelChain, attempts: totalAttempts,
    lastError: lastError?.kind,
  });
  metricsLog.error("ai_gateway_all_failed", lastError ?? new Error("all_models_failed"), {
    duration_ms: Date.now() - startedAt,
    status_code: lastError?.status ?? 500,
    tags: ["ai", provider, "error", lastError?.kind ?? "unknown"],
    provider, models: modelChain, attempts: totalAttempts,
  });
  await metricsLog.flush().catch(() => undefined);
  throw lastError ?? new AiGatewayError("all_models_failed", "All models exhausted");
}

/** Convenience: extract just the text content for simple completions. */
export async function aiComplete(opts: AiChatOptions): Promise<string | null> {
  const r = await aiChat(opts);
  return r.content;
}
