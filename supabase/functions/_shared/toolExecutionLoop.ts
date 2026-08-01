/**
 * toolExecutionLoop.ts — Reusable AI tool-call loop with safe defaults.
 *
 * Purpose: factor out the duplicated "while (msg.tool_calls && iter < N)"
 * pattern from ai-assistant and agent-execute. Both used the same shape but
 * with subtle differences (timeout, fallback models, repetition detection).
 * This helper centralizes that, so both functions stay aligned.
 *
 * Notes:
 *  - Does NOT replace the existing loops yet — they keep working as-is.
 *  - New code (tools, edge functions) should call runToolLoop().
 */

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface AssistantMessage {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface ChatMessage {
  role: string;
  content: string | null | unknown;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolLoopConfig {
  /** Max iterations (default 8). */
  maxIterations?: number;
  /** AbortController timeout per AI call in ms (default 45_000). */
  perCallTimeoutMs?: number;
  /** Fallback models to try in order if primary fails. */
  fallbackModels: string[];
  /** AI gateway URL. */
  aiUrl: string;
  /** Headers (must include Authorization). */
  aiHeaders: Record<string, string>;
  /** Tool definitions to expose to the model. */
  tools?: Array<Record<string, unknown>>;
  /** Max tokens for completion. */
  maxTokens?: number;
  /** Detect & break on repeated identical tool calls (default true). */
  detectRepetition?: boolean;
}

export interface ToolLoopResult {
  finalMessage: AssistantMessage | null;
  iterations: number;
  brokeOnRepetition: boolean;
  modelErrors: string[];
}

/**
 * Executes the AI ↔ tool-call loop until the assistant returns a final
 * answer (no more tool_calls), max iterations are reached, or all models
 * fail.
 *
 * The caller provides:
 *  - initial messages
 *  - executeTool(name, args) → result
 */
export async function runToolLoop(
  initialMessages: ChatMessage[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  config: ToolLoopConfig,
): Promise<ToolLoopResult> {
  const messages = [...initialMessages];
  const maxIterations = config.maxIterations ?? 8;
  const perCallTimeoutMs = config.perCallTimeoutMs ?? 45_000;
  const detectRepetition = config.detectRepetition ?? true;
  const modelErrors: string[] = [];

  let iterations = 0;
  let lastSignature = "";
  let repeatCount = 0;
  let brokeOnRepetition = false;

  // Initial call
  let response = await callWithFallback(config, messages, perCallTimeoutMs, modelErrors);
  if (!response) return { finalMessage: null, iterations, brokeOnRepetition, modelErrors };

  let result = await response.json();
  let msg: AssistantMessage | undefined = result.choices?.[0]?.message;

  while (msg?.tool_calls?.length && iterations < maxIterations) {
    iterations++;

    if (detectRepetition) {
      const signature = msg.tool_calls
        .map((tc) => `${tc.function.name}:${tc.function.arguments}`)
        .join("|");
      if (signature === lastSignature) {
        repeatCount++;
        if (repeatCount >= 2) {
          brokeOnRepetition = true;
          console.warn(`[toolExecutionLoop] Repetition detected (${signature.slice(0, 100)}), breaking`);
          break;
        }
      } else {
        repeatCount = 0;
        lastSignature = signature;
      }
    }

    const toolResults: ChatMessage[] = [];
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
      let toolResult: unknown;
      try {
        toolResult = await executeTool(tc.function.name, args);
      } catch (e) {
        toolResult = { error: String((e as Error)?.message || e) };
      }
      toolResults.push({
        role: "tool",
        tool_call_id: tc.id,
        content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
      });
    }

    messages.push(msg as ChatMessage);
    messages.push(...toolResults);

    response = await callWithFallback(config, messages, perCallTimeoutMs, modelErrors);
    if (!response) break;
    result = await response.json();
    msg = result.choices?.[0]?.message;
  }

  return {
    finalMessage: msg ?? null,
    iterations,
    brokeOnRepetition,
    modelErrors,
  };
}

async function callWithFallback(
  config: ToolLoopConfig,
  messages: ChatMessage[],
  timeoutMs: number,
  errors: string[],
): Promise<Response | null> {
  for (const model of config.fallbackModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(config.aiUrl, {
        method: "POST",
        headers: config.aiHeaders,
        body: JSON.stringify({
          model,
          messages,
          ...(config.tools && config.tools.length > 0 ? { tools: config.tools } : {}),
          max_tokens: config.maxTokens ?? 4000,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) return response;
      const txt = await response.text();
      errors.push(`${model}: HTTP ${response.status} ${txt.slice(0, 200)}`);
    } catch (e) {
      clearTimeout(timeoutId);
      const name = (e as { name?: string })?.name;
      errors.push(`${model}: ${name === "AbortError" ? "timeout" : String((e as Error)?.message || e)}`);
    }
  }
  return null;
}