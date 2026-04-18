// Shared message compression (rolling summary) usable across edge functions.
// Extracted from ai-assistant/contextLoader.ts so other functions (e.g. agent-execute)
// can import without depending on another function's directory.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return String(e); } catch { return "unknown error"; }
}

export async function compressMessages(
  supabase: SupabaseClient,
  messages: Record<string, unknown>[],
  apiKey: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  if (messages.length <= 8) return messages;

  const LIVE_WINDOW = 6;
  const recentMessages = messages.slice(messages.length - LIVE_WINDOW);

  const { data: existingSummary } = await supabase
    .from("ai_memory")
    .select("content")
    .eq("user_id", userId)
    .eq("source", "rolling_summary")
    .order("created_at", { ascending: false })
    .limit(1);

  const olderMessages = messages.slice(0, messages.length - LIVE_WINDOW);
  generateAndSaveSummary(supabase, olderMessages, apiKey, userId)
    .catch((e: unknown) => console.warn("Background summary failed:", extractErrorMessage(e)));

  const summaryRow = (existingSummary as Record<string, unknown>[] | null)?.[0];
  if (summaryRow?.content) {
    return [
      { role: "system", content: `RIEPILOGO CONVERSAZIONE PRECEDENTE:\n${summaryRow.content}` },
      ...recentMessages,
    ];
  }

  return recentMessages;
}

async function generateAndSaveSummary(
  supabase: SupabaseClient,
  olderMessages: Record<string, unknown>[],
  apiKey: string,
  userId: string,
): Promise<void> {
  const summaryPrompt = `Riassumi in modo conciso (3-5 righe) il contesto operativo di questa conversazione. Cattura: decisioni prese, azioni eseguite, dati importanti menzionati, richieste pendenti.\n\n${olderMessages.map((m) => `${m.role}: ${String(m.content || "").substring(0, 300)}`).join("\n")}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: summaryPrompt }],
        max_tokens: 300,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const summary = data.choices?.[0]?.message?.content;
      if (summary) {
        await supabase.from("ai_memory").delete().eq("user_id", userId).eq("source", "rolling_summary");
        await supabase.from("ai_memory").insert({
          user_id: userId,
          content: summary,
          memory_type: "conversation",
          tags: ["session_summary", "chat_memory", new Date().toISOString().split("T")[0]],
          importance: 2,
          level: 1,
          confidence: 0.4,
          decay_rate: 0.02,
          source: "rolling_summary",
        });
      }
    }
  } catch (e: unknown) {
    console.error("[ChatMemory] Background summary generation failed:", extractErrorMessage(e));
  }
}
