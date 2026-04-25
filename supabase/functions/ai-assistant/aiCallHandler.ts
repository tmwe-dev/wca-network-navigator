/**
 * aiCallHandler.ts
 * Handles AI provider calls with model fallback logic.
 * Manages tool definitions, message formatting, and response parsing.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getScopeConfig } from "../_shared/scopeConfigs.ts";

export interface AiProvider {
  url: string;
  apiKey: string;
  model: string;
  isUserKey: boolean;
}

export interface AiCallOptions {
  model: string;
  messages: Record<string, unknown>[];
  tools?: Record<string, unknown>[];
  temperature?: number;
  max_tokens?: number;
  response_format?: Record<string, unknown>;
}

export interface AiCallResult {
  ok: boolean;
  status?: number;
  data?: Record<string, unknown>;
  errorText?: string;
  triedModel?: string;
}

/**
 * Determine which tools to use based on scope
 */
export function selectActiveTools(
  allTools: Record<string, unknown>[],
  scope: string | undefined,
  isConversational: boolean
): Record<string, unknown>[] | undefined {
  if (isConversational) return undefined;

  if (!scope || scope === "partner_hub") {
    return allTools;
  }

  try {
    const scopeConfig = getScopeConfig(scope);
    const scopeTools = scopeConfig.tools as Record<string, unknown>[];
    return scopeTools;
  } catch {
    
    return allTools;
  }
}

/**
 * Determine model fallback chain based on provider and mode
 */
export function selectFallbackModels(
  provider: AiProvider,
  isConversational: boolean,
  scope: string | undefined
): string[] {
  if (provider.isUserKey) {
    return [provider.model];
  }

  // Scope config ha priorità SEMPRE (anche in conversational): scope
  // specializzati come kb-supervisor o mission-builder hanno modelli
  // tarati esplicitamente. Hardcodare flash/gpt-5-mini in conversational
  // ignorava la scelta del scope → output sotto-tono o vuoto.
  let scopeModel: string | undefined;
  if (scope && scope !== "partner_hub") {
    try {
      const sc = getScopeConfig(scope);
      if (sc.model) scopeModel = sc.model;
    } catch {
      /* ignore */
    }
  }

  if (scopeModel) {
    return [scopeModel, provider.model, "openai/gpt-5-mini"];
  }

  if (isConversational) {
    return ["google/gemini-2.5-flash", "openai/gpt-5-mini"];
  }

  return [provider.model, "google/gemini-2.5-flash", "openai/gpt-5-mini"];
}

/**
 * Make a single AI call
 */
async function makeAiCall(
  provider: AiProvider,
  options: AiCallOptions
): Promise<AiCallResult> {
  const fetchBody: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
  };
  if (options.tools) fetchBody.tools = options.tools;
  if (options.temperature !== undefined) fetchBody.temperature = options.temperature;
  if (options.max_tokens !== undefined) fetchBody.max_tokens = options.max_tokens;
  if (options.response_format) fetchBody.response_format = options.response_format;

  // Token-budget visibility: helps diagnose token-explosion empty-response cases
  try {
    let userChars = 0;
    let systemChars = 0;
    for (const m of options.messages as Array<{ role?: string; content?: string }>) {
      const c = typeof m?.content === "string" ? m.content.length : 0;
      if (m?.role === "system") systemChars += c;
      else userChars += c;
    }
    console.log("[AI] call", {
      model: options.model,
      systemChars,
      userChars,
      totalChars: systemChars + userChars,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      tools: Array.isArray(options.tools) ? options.tools.length : 0,
    });
  } catch { /* ignore log failure */ }

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fetchBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      status: response.status,
      errorText,
      triedModel: options.model,
    };
  }

  try {
    const data = await response.json();
    // Empty-content guard: gateway can return 200 with empty content on
    // token explosion. Treat as transient so the fallback chain can retry.
    const choice = (data?.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const msg = choice?.message as Record<string, unknown> | undefined;
    const contentVal = msg?.content;
    const toolCalls = msg?.tool_calls as unknown[] | undefined;
    const hasContent = typeof contentVal === "string" && contentVal.trim().length > 0;
    const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
    if (!hasContent && !hasToolCalls) {
      const fr = choice?.finish_reason;
      console.warn("[AI] empty content from model", {
        model: options.model,
        finish_reason: fr,
        truncated: fr === "length",
        usage: data?.usage,
      });
      return {
        ok: false,
        status: 599,
        errorText: "empty_content",
        triedModel: options.model,
      };
    }
    return {
      ok: true,
      data,
      triedModel: options.model,
    };
  } catch (e) {
    return {
      ok: false,
      status: response.status,
      errorText: "Failed to parse response JSON",
      triedModel: options.model,
    };
  }
}

/**
 * Call AI with automatic fallback to alternative models
 */
export async function callAiWithFallback(
  provider: AiProvider,
  isConversational: boolean,
  scope: string | undefined,
  messages: Record<string, unknown>[],
  allTools: Record<string, unknown>[] | undefined
): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  statusCode?: number;
}> {
  const fallbackModels = selectFallbackModels(
    provider,
    isConversational,
    scope
  );
  const activeTools = allTools
    ? selectActiveTools(allTools, scope, isConversational)
    : undefined;

  // Pull temperature/max_tokens from scope config so kb-supervisor and other
  // specialized scopes get their tuned generation parameters even in
  // conversational mode (fixes empty-content on large prompts).
  let scopeTemperature: number | undefined;
  let scopeMaxTokens: number | undefined;
  if (scope) {
    try {
      const sc = getScopeConfig(scope);
      if (typeof sc.temperature === "number") scopeTemperature = sc.temperature;
      if (typeof sc.maxTokens === "number") scopeMaxTokens = sc.maxTokens;
    } catch { /* ignore */ }
  }
  // kb-supervisor: prima del fix, max_tokens non veniva propagato affatto al
  // gateway → output troncato dal default del modello. Ora 32K esplicito per
  // accomodare JSON TMWE densi (proposals + extracted_facts + new_conflicts).
  // Modello scelto: google/gemini-2.5-flash (vedi scopeConfigs).
  if (scope === "kb-supervisor" && scopeMaxTokens === undefined) {
    scopeMaxTokens = 32000;
  }
  if (scope === "kb-supervisor" && scopeTemperature === undefined) {
    scopeTemperature = 0.2;
  }

  for (const tryModel of fallbackModels) {
    

    const result = await makeAiCall(provider, {
      model: tryModel,
      messages,
      tools: activeTools,
      temperature: scopeTemperature,
      max_tokens: scopeMaxTokens,
    });

    if (result.ok && result.data) {
      if (tryModel !== provider.model) {
      }
      return { ok: true, data: result.data };
    }

    const errStatus = result.status || 0;
    console.error(
      `AI gateway error (${tryModel}):`,
      errStatus,
      result.errorText
    );

    // Rate limit or out of credits
    if (errStatus === 429 || errStatus === 402) {
      const errorMsg =
        errStatus === 429
          ? "Troppe richieste, riprova tra poco."
          : "Crediti AI esauriti.";
      return {
        ok: false,
        error: errorMsg,
        statusCode: errStatus,
      };
    }

    // Permanent errors (not server errors). 599 = our internal "empty_content"
    // sentinel, treat it like a transient server error so we try the next model.
    if (errStatus !== 503 && errStatus !== 500 && errStatus !== 529 && errStatus !== 599) {
      return {
        ok: false,
        error: "Errore AI gateway",
        statusCode: errStatus,
      };
    }

    // Server error: try next model
  }

  console.error("[AI] All models failed");
  return {
    ok: false,
    error:
      "Tutti i modelli AI sono temporaneamente non disponibili. Riprova tra qualche minuto.",
    statusCode: 503,
  };
}

/**
 * Call AI for tool-loop iteration (with fallback)
 */
export async function callAiForToolLoop(
  provider: AiProvider,
  isConversational: boolean,
  scope: string | undefined,
  messages: Record<string, unknown>[],
  allTools: Record<string, unknown>[] | undefined
): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  statusCode?: number;
}> {
  return callAiWithFallback(
    provider,
    isConversational,
    scope,
    messages,
    allTools
  );
}

/**
 * Call AI without tools (fallback for when tool loop fails)
 */
export async function callAiWithoutTools(
  provider: AiProvider,
  messages: Record<string, unknown>[]
): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  statusCode?: number;
}> {
  const result = await makeAiCall(provider, {
    model: provider.model,
    messages,
  });

  if (result.ok && result.data) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: result.errorText || "Errore finale",
    statusCode: result.status,
  };
}
