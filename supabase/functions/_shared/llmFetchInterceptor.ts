/**
 * llmFetchInterceptor — Intercetta globalmente tutte le chiamate fetch verso
 * provider LLM (Lovable Gateway, OpenAI, Anthropic) e logga automaticamente
 * in `ai_prompt_log` senza richiedere modifiche al codice chiamante.
 *
 * Garantisce copertura 100% del tracking AI cost anche per le edge function
 * "ribelli" che chiamano fetch direttamente invece di usare aiChat/callLLM.
 *
 * USAGE: in cima a `index.ts` di un'edge function, una sola riga:
 *   import "../_shared/llmFetchInterceptor.ts";
 *
 * L'interceptor è idempotente — multiple import non installano hooks duplicati.
 * Best-effort: se il logging fallisce, la chiamata LLM originale procede normalmente.
 */

import { estimateCostUsd } from "./llmPricing.ts";

const LLM_HOST_PATTERNS: Array<{ host: RegExp; provider: string }> = [
  { host: /(^|\.)ai\.gateway\.lovable\.dev$/i, provider: "lovable" },
  { host: /(^|\.)api\.openai\.com$/i, provider: "openai" },
  { host: /(^|\.)api\.anthropic\.com$/i, provider: "anthropic" },
  { host: /(^|\.)generativelanguage\.googleapis\.com$/i, provider: "google" },
];

function detectProvider(url: string): string | null {
  try {
    const u = new URL(url);
    for (const { host, provider } of LLM_HOST_PATTERNS) {
      if (host.test(u.hostname)) return provider;
    }
  } catch {
    // not a URL
  }
  return null;
}

function getCallerFunctionName(): string {
  // 1) Esplicito via env (settato da bootstrap edge)
  const explicit = Deno.env.get("SUPABASE_FUNCTION_NAME") || Deno.env.get("FUNCTION_NAME");
  if (explicit) return explicit;

  // 2) Stack trace inspection — cerca il primo frame in /functions/<name>/
  //    saltando i frame "infrastruttura" (_shared) per attribuire alla funzione reale.
  const stack = new Error().stack ?? "";
  const all = [...stack.matchAll(/\/functions\/([^/]+)\//g)].map((m) => m[1]);
  const real = all.find((n) => n !== "_shared");
  if (real) return real;
  if (all.length > 0) return all[0];

  return "unknown";
}

interface ParsedRequest {
  model: string | null;
  messages: Array<{ role: string; content?: unknown }>;
  isAnthropic: boolean;
}

function tryParseRequestBody(body: BodyInit | null | undefined, isAnthropic: boolean): ParsedRequest {
  if (typeof body !== "string") return { model: null, messages: [], isAnthropic };
  try {
    const parsed = JSON.parse(body);
    return {
      model: typeof parsed.model === "string" ? parsed.model : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      isAnthropic,
    };
  } catch {
    return { model: null, messages: [], isAnthropic };
  }
}

function extractUsage(data: unknown, isAnthropic: boolean): { tokensIn: number; tokensOut: number } {
  if (!data || typeof data !== "object") return { tokensIn: 0, tokensOut: 0 };
  const obj = data as Record<string, unknown>;
  if (isAnthropic) {
    const usage = obj.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return {
      tokensIn: Number(usage?.input_tokens || 0),
      tokensOut: Number(usage?.output_tokens || 0),
    };
  }
  const usage = obj.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  return {
    tokensIn: Number(usage?.prompt_tokens || 0),
    tokensOut: Number(usage?.completion_tokens || 0),
  };
}

/** Estrae la usage da una risposta SSE (stream) leggendo l'ultimo chunk con `usage`. */
function extractUsageFromSse(text: string, isAnthropic: boolean): { tokensIn: number; tokensOut: number } {
  let last = { tokensIn: 0, tokensOut: 0 };
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const u = extractUsage(JSON.parse(payload), isAnthropic);
      if (u.tokensIn || u.tokensOut) last = u;
    } catch {
      /* chunk non-JSON */
    }
  }
  return last;
}

function charsByRole(messages: Array<{ role: string; content?: unknown }>) {
  let sysChars = 0,
    userChars = 0,
    otherChars = 0;
  for (const m of messages) {
    const c = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    if (m.role === "system") sysChars += c.length;
    else if (m.role === "user") userChars += c.length;
    else otherChars += c.length;
  }
  return { sysChars, userChars, otherChars };
}

async function logCallToDb(params: {
  functionName: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  systemPromptChars: number;
  userPromptChars: number;
  contextChars: number;
  success: boolean;
  errorMessage?: string | null;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
    const supa = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { logAiPrompt } = await import("./tokenLogger.ts");
    await logAiPrompt(supa, {
      userId: null,
      functionName: params.functionName,
      provider: params.provider,
      model: params.model,
      groupCategory: "auto-tracked",
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      costUsd: params.costUsd,
      latencyMs: params.latencyMs,
      systemPromptChars: params.systemPromptChars,
      userPromptChars: params.userPromptChars,
      contextChars: params.contextChars,
      success: params.success,
      errorMessage: params.errorMessage ?? null,
      metadata: { source: "fetch_interceptor" },
    });
  } catch (e) {
    console.warn("[llmFetchInterceptor] log failed:", e instanceof Error ? e.message : String(e));
  }
}

const INSTALLED_FLAG = "__llm_fetch_interceptor_installed__";

function install() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  if (g[INSTALLED_FLAG]) return;
  g[INSTALLED_FLAG] = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    const provider = detectProvider(url);
    if (!provider) return originalFetch(input as RequestInfo, init);

    const startedAt = Date.now();
    const isAnthropic = provider === "anthropic";
    let usedInit = init;
    // Per le richieste in streaming OpenAI/Lovable/Google forziamo include_usage
    // così l'ultimo chunk SSE contiene i token (altrimenti non misurabili).
    if (!isAnthropic && typeof init?.body === "string") {
      try {
        const b = JSON.parse(init.body);
        if (b && b.stream === true && !b.stream_options) {
          b.stream_options = { include_usage: true };
          usedInit = { ...init, body: JSON.stringify(b) };
        }
      } catch {
        /* body non-JSON: lascia invariato */
      }
    }
    const parsed = tryParseRequestBody(usedInit?.body, isAnthropic);
    const functionName = getCallerFunctionName();

    try {
      const resp = await originalFetch(input as RequestInfo, usedInit);

      // Clone per non consumare il body originale
      const cloned = resp.clone();
      const contentType = resp.headers.get("content-type") || "";
      const isStream = contentType.includes("text/event-stream");
      // Logging async, non blocchiamo la risposta
      const usagePromise: Promise<{ tokensIn: number; tokensOut: number }> = isStream
        ? cloned.text().then((t) => extractUsageFromSse(t, isAnthropic))
        : cloned.json().then((d) => extractUsage(d, isAnthropic));
      usagePromise
        .then(({ tokensIn, tokensOut }) => {
          if (tokensIn === 0 && tokensOut === 0 && !resp.ok) {
            // Errore senza token usage: logga comunque come failure
            const { sysChars, userChars, otherChars } = charsByRole(parsed.messages);
            void logCallToDb({
              functionName,
              provider,
              model: parsed.model ?? "unknown",
              tokensIn: 0,
              tokensOut: 0,
              costUsd: 0,
              latencyMs: Date.now() - startedAt,
              systemPromptChars: sysChars,
              userPromptChars: userChars,
              contextChars: otherChars,
              success: false,
              errorMessage: `HTTP ${resp.status}`,
            });
            return;
          }
          const { sysChars, userChars, otherChars } = charsByRole(parsed.messages);
          const model = parsed.model ?? "unknown";
          void logCallToDb({
            functionName,
            provider,
            model,
            tokensIn,
            tokensOut,
            costUsd: estimateCostUsd(model, tokensIn, tokensOut),
            latencyMs: Date.now() - startedAt,
            systemPromptChars: sysChars,
            userPromptChars: userChars,
            contextChars: otherChars,
            success: resp.ok,
          });
        })
        .catch(() => {
          // Non-JSON response: non logghiamo
        });

      return resp;
    } catch (err) {
      const { sysChars, userChars, otherChars } = charsByRole(parsed.messages);
      void logCallToDb({
        functionName,
        provider,
        model: parsed.model ?? "unknown",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
        systemPromptChars: sysChars,
        userPromptChars: userChars,
        contextChars: otherChars,
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };

  console.log("[llmFetchInterceptor] installed — auto-tracking LLM calls");
}

install();
