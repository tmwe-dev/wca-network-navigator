/**
 * Shared assistant engine — common AI gateway + tool-calling loop pattern.
 * Used by unified-assistant for all non-partner_hub scopes.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { executePlatformTool } from "./platformTools.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface AssistantConfig {
  systemPrompt: string;
  tools: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  userId: string;
  authHeader: string;
  /** Handle scope-specific tools. Return null if not handled. */
  localToolHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown | null>;
  model?: string;
  temperature?: number;
  maxIterations?: number;
  /** Label for credit deduction */
  creditLabel?: string;
}

export interface AssistantResult {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export async function runAssistant(config: AssistantConfig): Promise<AssistantResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const model = config.model || "google/gemini-3-flash-preview";
  const maxIter = config.maxIterations ?? 5;
  const allMessages: Array<Record<string, unknown>> = [
    { role: "system", content: config.systemPrompt },
    ...config.messages,
  ];

  let response: Response | null = null;
  const MAX_RETRIES = 2;
  const requestBody = JSON.stringify({
    model,
    messages: allMessages,
    tools: config.tools.length > 0 ? config.tools : undefined,
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: requestBody,
    });

    if (response.ok) break;

    const status = response.status;
    if (status === 429) throw Object.assign(new Error("Rate limit"), { status: 429 });
    if (status === 402) throw Object.assign(new Error("Crediti AI esauriti"), { status: 402 });
    if (status < 500) {
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      throw Object.assign(new Error(`AI error: ${status}`), { status });
    }

    if (attempt < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, attempt);
      console.warn(`AI gateway 5xx (${status}), retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    } else {
      const text = await response.text();
      console.error("AI gateway error after retries:", status, text);
      throw Object.assign(new Error(`AI error: ${status}`), { status: 500 });
    }
  }

  if (!response || !response.ok) {
    throw Object.assign(new Error("AI gateway: no response after retries"), { status: 500 });
  }

  let result = await response.json();
  let assistantMessage = result.choices?.[0]?.message;
  const totalUsage = {
    prompt_tokens: result.usage?.prompt_tokens || 0,
    completion_tokens: result.usage?.completion_tokens || 0,
  };

  // Tool calling loop
  let iterations = 0;
  while (assistantMessage?.tool_calls?.length && iterations < maxIter) {
    iterations++;
    const toolResults = [];
    for (const tc of assistantMessage.tool_calls) {
      const fnName = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}");

      // Try local handler first, then platform tools
      let toolResult: unknown = null;
      if (config.localToolHandler) {
        toolResult = await config.localToolHandler(fnName, args);
      }
      if (toolResult === null) {
        toolResult = await executePlatformTool(fnName, args, config.userId, config.authHeader);
      }
      toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
    }

    allMessages.push(assistantMessage);
    allMessages.push(...toolResults);

    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: allMessages,
        tools: config.tools.length > 0 ? config.tools : undefined,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
      }),
    });

    if (!response.ok) {
      console.error("AI error on tool response:", response.status, await response.text());
      break;
    }

    result = await response.json();
    assistantMessage = result.choices?.[0]?.message;
    if (result.usage) {
      totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += result.usage.completion_tokens || 0;
    }
  }

  const content = assistantMessage?.content || "";

  // Credit deduction
  if (config.creditLabel && config.userId) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const totalCredits = Math.max(1, Math.ceil(
      (totalUsage.prompt_tokens + totalUsage.completion_tokens * 3) / 1000,
    ));
    await supabase.rpc("deduct_credits", {
      p_user_id: config.userId,
      p_amount: totalCredits,
      p_operation: "ai_call",
      p_description: `${config.creditLabel}: ${totalUsage.prompt_tokens}in + ${totalUsage.completion_tokens}out (${totalCredits} crediti)`,
    });
  }

  return { content, usage: totalUsage };
}
