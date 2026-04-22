/**
 * memoryContextLoader.ts — AI memory context with tiered retrieval.
 *
 * Handles:
 * - Semantic memory search (RAG)
 * - Tiered memory levels (L1/L2/L3)
 * - Work plans context
 * - Message compression for rolling summaries
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

type SupabaseClient = ReturnType<typeof createClient>;

const typeEmoji: Record<string, string> = { preference: "⭐", decision: "🎯", fact: "📌", conversation: "💬" };

export async function loadMemoryContext(supabase: SupabaseClient, userId: string, query?: string): Promise<string> {
  // ── Try semantic search first if query is provided ──
  if (query && query.trim().length >= 5) {
    try {
      const { ragSearchMemory } = await import("../_shared/embeddings.ts");
      const matches = await ragSearchMemory(supabase, query, {
        matchCount: 15,
        matchThreshold: 0.2,
        filterUserId: userId,
      });

      if (matches.length > 0) {
        // Group by level
        const byLevel: Record<number, Array<Record<string, unknown>>> = { 3: [], 2: [], 1: [] };
        const allIds: string[] = [];

        for (const m of matches) {
          const lvl = m.level as number;
          if (!byLevel[lvl]) byLevel[lvl] = [];
          byLevel[lvl].push(m as unknown as Record<string, unknown>);
          allIds.push(m.id);
        }

        // Increment access counts
        if (allIds.length > 0) {
          supabase.rpc("increment_memory_access", { memory_ids: allIds })
            .then(() => {})
            .catch((e: unknown) => console.warn("increment_memory_access failed:", extractErrorMessage(e)));
        }

        let context = "\n\nMEMORIA OPERATIVA (RAG semantic, L3=permanente, L2=operativa, L1=sessione):";
        const levelNames: Record<number, string> = { 3: "L3 PERMANENTE", 2: "L2 OPERATIVA", 1: "L1 SESSIONE" };

        for (const lvl of [3, 2, 1]) {
          const memories = byLevel[lvl];
          if (!memories?.length) continue;
          context += `\n[${levelNames[lvl]}]\n`;
          for (const m of memories) {
            const emoji = typeEmoji[m.memory_type as string] || "📝";
            const conf = Math.round((m.confidence as number) * 100);
            const sim = Math.round((m.similarity as number) * 100);
            const tags = Array.isArray(m.tags) ? m.tags.join(", ") : "";
            context += `${emoji} ${m.content} (conf: ${conf}%, sim: ${sim}%, tags: ${tags})\n`;
          }
        }

        // Always load work plans in parallel
        const { data: plans } = await supabase
          .from("ai_work_plans")
          .select("id, title, status, current_step, steps, tags")
          .eq("user_id", userId)
          .in("status", ["running", "paused"])
          .limit(5);

        if (plans && plans.length > 0) {
          context += "\n\nPIANI DI LAVORO ATTIVI:\n";
          for (const p of plans as Record<string, unknown>[]) {
            const steps = p.steps as Record<string, unknown>[];
            context += `🔄 "${p.title}" — stato: ${p.status}, progresso: ${p.current_step}/${steps.length}\n`;
            const nextStep = steps[p.current_step as number];
            if (nextStep) context += `   → Prossimo step: ${nextStep.description}\n`;
          }
        }

        return context;
      }
    } catch (e: unknown) {
      console.warn("Memory RAG search failed, falling back to tiered queries:", extractErrorMessage(e));
    }
  }

  // ── Fallback: tiered L3/L2/L1 queries ──
  const [l3Res, l2Res, l1Res, plansRes] = await Promise.all([
    supabase.from("ai_memory").select("id, content, memory_type, tags, importance, level, confidence").eq("user_id", userId).eq("level", 3).or("expires_at.is.null,expires_at.gt.now()").order("importance", { ascending: false }).limit(10),
    supabase.from("ai_memory").select("id, content, memory_type, tags, importance, level, confidence").eq("user_id", userId).eq("level", 2).or("expires_at.is.null,expires_at.gt.now()").order("confidence", { ascending: false }).limit(10),
    supabase.from("ai_memory").select("id, content, memory_type, tags, importance, level, confidence").eq("user_id", userId).eq("level", 1).or("expires_at.is.null,expires_at.gt.now()").order("created_at", { ascending: false }).limit(5),
    supabase.from("ai_work_plans").select("id, title, status, current_step, steps, tags").eq("user_id", userId).in("status", ["running", "paused"]).limit(5),
  ]);

  const allMemoryIds: string[] = [];
  for (const res of [l3Res, l2Res, l1Res]) {
    if (res.data) allMemoryIds.push(...(res.data as Record<string, unknown>[]).map((m) => m.id as string));
  }
  if (allMemoryIds.length > 0) {
    supabase.rpc("increment_memory_access", { memory_ids: allMemoryIds })
      .then(() => {})
      .catch((e: unknown) => console.warn("increment_memory_access failed:", extractErrorMessage(e)));
  }

  let context = "";

  const formatMemories = (memories: Record<string, unknown>[] | null, levelName: string) => {
    if (!memories?.length) return "";
    let s = `\n[${levelName}]\n`;
    for (const m of memories) {
      s += `${typeEmoji[m.memory_type as string] || "📝"} ${m.content} (conf: ${Math.round((m.confidence as number) * 100)}%, tags: ${(Array.isArray(m.tags) ? m.tags.join(", ") : "")})\n`;
    }
    return s;
  };

  if (l3Res.data?.length || l2Res.data?.length || l1Res.data?.length) {
    context += "\n\nMEMORIA OPERATIVA (L3=permanente, L2=operativa, L1=sessione):";
    context += formatMemories(l3Res.data as Record<string, unknown>[] | null, "L3 PERMANENTE");
    context += formatMemories(l2Res.data as Record<string, unknown>[] | null, "L2 OPERATIVA");
    context += formatMemories(l1Res.data as Record<string, unknown>[] | null, "L1 SESSIONE");
  }

  if (plansRes.data && plansRes.data.length > 0) {
    context += "\n\nPIANI DI LAVORO ATTIVI:\n";
    for (const p of plansRes.data as Record<string, unknown>[]) {
      const steps = p.steps as Record<string, unknown>[];
      context += `🔄 "${p.title}" — stato: ${p.status}, progresso: ${p.current_step}/${steps.length}\n`;
      const nextStep = steps[p.current_step as number];
      if (nextStep) context += `   → Prossimo step: ${nextStep.description}\n`;
    }
  }

  return context;
}

export async function compressMessages(supabase: SupabaseClient, messages: Record<string, unknown>[], apiKey: string, userId: string): Promise<Record<string, unknown>[]> {
  if (messages.length <= 8) return messages;

  const LIVE_WINDOW = 6;
  const recentMessages = messages.slice(messages.length - LIVE_WINDOW);

  const { data: existingSummary } = await supabase
    .from("ai_memory").select("content").eq("user_id", userId).eq("source", "rolling_summary").order("created_at", { ascending: false }).limit(1);

  if ((existingSummary as Record<string, unknown>[] | null)?.[0]?.content) {
    const olderMessages = messages.slice(0, messages.length - LIVE_WINDOW);
    generateAndSaveSummary(supabase, olderMessages, apiKey, userId)
      .catch((e: unknown) => console.warn("Background summary failed:", extractErrorMessage(e)));

    return [
      { role: "system", content: `RIEPILOGO CONVERSAZIONE PRECEDENTE:\n${(existingSummary as Record<string, unknown>[])[0].content}` },
      ...recentMessages,
    ];
  }

  const olderMessages = messages.slice(0, messages.length - LIVE_WINDOW);
  generateAndSaveSummary(supabase, olderMessages, apiKey, userId)
    .catch((e: unknown) => console.warn("Background summary failed:", extractErrorMessage(e)));

  return recentMessages;
}

async function generateAndSaveSummary(supabase: SupabaseClient, olderMessages: Record<string, unknown>[], apiKey: string, userId: string): Promise<void> {
  const summaryPrompt = `Riassumi in modo conciso (3-5 righe) il contesto operativo di questa conversazione. Cattura: decisioni prese, azioni eseguite, dati importanti menzionati, richieste pendenti.\n\n${olderMessages.map((m) => `${m.role}: ${String(m.content || "").substring(0, 300)}`).join("\n")}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: summaryPrompt }], max_tokens: 300 }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const summary = data.choices?.[0]?.message?.content;
      if (summary) {
        await supabase.from("ai_memory").delete().eq("user_id", userId).eq("source", "rolling_summary");
        await supabase.from("ai_memory").insert({
          user_id: userId, content: summary, memory_type: "conversation",
          tags: ["session_summary", "chat_memory", new Date().toISOString().split("T")[0]],
          importance: 2, level: 1, confidence: 0.4, decay_rate: 0.02, source: "rolling_summary",
        });
      }
    }
  } catch (e: unknown) {
    console.error("[ChatMemory] Background summary generation failed:", extractErrorMessage(e));
  }
}
