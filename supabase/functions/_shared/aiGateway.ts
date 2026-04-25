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

          // Granular log on ai_prompt_log (parallel to ai_token_usage for backward compat)
          if (opts.supabase && opts.functionName) {
            try {
              const { logAiPrompt } = await import("./tokenLogger.ts");
              const sysChars = opts.messages
                .filter((m) => m.role === "system")
                .reduce((s, m) => s + (m.content?.length ?? 0), 0);
              const userChars = opts.messages
                .filter((m) => m.role === "user")
                .reduce((s, m) => s + (m.content?.length ?? 0), 0);
              const otherChars = opts.messages
                .filter((m) => m.role !== "system" && m.role !== "user")
                .reduce((s, m) => s + (m.content?.length ?? 0), 0);
              // Rough cost estimate (Gemini Flash pricing as default)
              const costUsd = (usage.promptTokens * 0.075 + usage.completionTokens * 0.30) / 1_000_000;
              await logAiPrompt(opts.supabase, {
                userId: opts.userId ?? null,
                operatorId: opts.operatorId ?? null,
                functionName: opts.functionName,
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
