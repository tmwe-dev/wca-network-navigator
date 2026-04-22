// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHAT MODE EXECUTION - AI Conversation & Tool Calling Loop
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { executeTool } from "./toolHandlers.ts";
import { compressMessages } from "../_shared/messageCompression.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Execute chat mode: conversational AI with tool calling support
 */
export async function executeChatMode(
  supabase: SupabaseClient,
  systemPrompt: string,
  chatMessages: ChatMessage[],
  agentTools: Record<string, unknown>[],
  agentId: string,
  agentName: string,
  userId: string,
  authHeader: string,
  apiKey: string
): Promise<Response> {
  const LOVABLE_API_KEY = apiKey || Deno.env.get("LOVABLE_API_KEY");
  const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
  const fallbackModels = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "openai/gpt-5-mini"];

  // Compress long histories (threshold: 8 messages)
  let processedMessages = chatMessages.map((m: ChatMessage) => ({ role: m.role, content: m.content })) as Record<string, unknown>[];
  if (processedMessages.length > 8) {
    try {
      const compressed = await compressMessages(supabase, processedMessages, LOVABLE_API_KEY || "", userId);
      console.log(`[chat-mode] Compressed ${processedMessages.length} → ${compressed.length} messages`);
      processedMessages = compressed;
    } catch (compressErr) {
      console.warn("[chat-mode] Compression failed, using original:", compressErr);
    }
  }

  const allMessages = [
    { role: "system", content: systemPrompt },
    ...processedMessages,
  ];

  let response: Response | null = null;
  for (const model of fallbackModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);
    try {
      response = await fetch(aiUrl, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model,
          messages: allMessages,
          ...(agentTools.length > 0 ? { tools: agentTools } : {}),
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });
      if (response.ok) {
        clearTimeout(timeoutId);
        break;
      }
      await response.text();
    } catch (e: unknown) {
      if ((e as { name?: string }).name === "AbortError") {
        console.warn(`[chat-mode] Timeout on model ${model}`);
      } else {
        throw e;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!response || !response.ok) {
    return new Response(
      JSON.stringify({
        error: "Errore AI",
        response: "Mi dispiace, tutti i modelli sono temporaneamente non disponibili.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let result = await response.json();
  let msg = result.choices?.[0]?.message;

  // Tool calling loop (max 8 iterations)
  let iterations = 0;
  while (msg?.tool_calls?.length && iterations < 8) {
    iterations++;
    const toolResults = [];
    for (const tc of msg.tool_calls) {
      console.log(`[Agent ${agentName}] Tool: ${tc.function.name}`);
      const args = JSON.parse(tc.function.arguments || "{}");
      const toolResult = await executeTool(tc.function.name, args, userId, authHeader, { agent_id: agentId });
      console.log(`[Agent ${agentName}] Result:`, JSON.stringify(toolResult).substring(0, 300));
      toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
    }
    allMessages.push(msg);
    allMessages.push(...toolResults);

    let loopOk = false;
    for (const model of fallbackModels) {
      response = await fetch(aiUrl, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model,
          messages: allMessages,
          ...(agentTools.length > 0 ? { tools: agentTools } : {}),
          max_tokens: 4000,
        }),
      });
      if (response!.ok) {
        loopOk = true;
        break;
      }
      await response!.text();
    }
    if (!loopOk) break;
    result = await response!.json();
    msg = result.choices?.[0]?.message;
  }

  return new Response(JSON.stringify({ response: msg?.content || "Nessuna risposta." }), {
    headers: { "Content-Type": "application/json" },
  });
}
