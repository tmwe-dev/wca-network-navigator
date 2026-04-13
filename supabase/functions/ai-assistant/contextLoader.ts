/**
 * contextLoader.ts — Context loading, AI provider resolution, credit consumption.
 * Extracted from ai-assistant/index.ts (lines 2988-3359).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";
import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

type SupabaseClient = ReturnType<typeof createClient>;

// ━━━ AI Provider Resolution ━━━

export interface ResolvedAiProvider {
  url: string;
  apiKey: string;
  model: string;
  isUserKey: boolean;
}

export async function resolveAiProvider(supabase: SupabaseClient, userId: string): Promise<ResolvedAiProvider> {
  const { data: userKeys } = await supabase
    .from("user_api_keys")
    .select("provider, api_key")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (userKeys && userKeys.length > 0) {
    const googleKey = (userKeys as Record<string, unknown>[]).find((k) => k.provider === "google");
    if (googleKey?.api_key) {
      console.log("[AI] Using user's Google API key");
      return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: googleKey.api_key as string, model: "gemini-2.5-flash", isUserKey: true };
    }
    const openaiKey = (userKeys as Record<string, unknown>[]).find((k) => k.provider === "openai");
    if (openaiKey?.api_key) {
      console.log("[AI] Using user's OpenAI API key");
      return { url: "https://api.openai.com/v1/chat/completions", apiKey: openaiKey.api_key as string, model: "gpt-5-mini", isUserKey: true };
    }
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  console.log("[AI] Using Lovable AI Gateway");
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: LOVABLE_API_KEY, model: "google/gemini-3-flash-preview", isUserKey: false };
}

// ━━━ Credit Consumption ━━━

export async function consumeCredits(supabase: SupabaseClient, userId: string, usage: { prompt_tokens?: number; completion_tokens?: number }, isUserKey: boolean): Promise<void> {
  if (isUserKey) return;
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  if (inputTokens === 0 && outputTokens === 0) return;
  const rates = { input: 1, output: 2 };
  const totalCredits = Math.ceil(inputTokens / 1000 * rates.input) + Math.ceil(outputTokens / 1000 * rates.output);
  if (totalCredits <= 0) return;
  const { data: deductResult } = await supabase.rpc("deduct_credits", {
    p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call",
    p_description: `AI Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)`,
  });
  const row = (deductResult as Record<string, unknown>[] | null)?.[0];
  console.log(`[CREDITS] User ${userId}: -${totalCredits} credits (success: ${row?.success}, balance: ${row?.new_balance})`);
}

// ━━━ Load User Profile ━━━

export async function loadUserProfile(supabase: SupabaseClient, userId?: string): Promise<string> {
  let query = supabase.from("app_settings").select("key, value").like("key", "ai_%");
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query;
  if (!data?.length) return "";

  const settings: Record<string, string> = {};
  for (const row of data as Record<string, unknown>[]) settings[row.key as string] = (row.value as string) || "";

  const parts: string[] = [];
  const get = (k: string) => settings[k]?.trim() || "";

  if (get("ai_current_focus")) parts.push(`🎯 FOCUS CORRENTE: ${get("ai_current_focus")}`);
  if (get("ai_company_name") || get("ai_company_alias")) parts.push(`AZIENDA: ${get("ai_company_name")} (${get("ai_company_alias")})`);
  if (get("ai_contact_name") || get("ai_contact_alias")) parts.push(`REFERENTE: ${get("ai_contact_name")} (${get("ai_contact_alias")}) — ${get("ai_contact_role")}`);
  if (get("ai_sector")) parts.push(`SETTORE: ${get("ai_sector")}`);
  if (get("ai_networks")) parts.push(`NETWORK: ${get("ai_networks")}`);
  if (get("ai_company_activities")) parts.push(`ATTIVITÀ: ${get("ai_company_activities")}`);
  if (get("ai_business_goals")) parts.push(`OBIETTIVI ATTUALI: ${get("ai_business_goals")}`);
  if (get("ai_tone")) parts.push(`TONO: ${get("ai_tone")}`);
  if (get("ai_language")) parts.push(`LINGUA: ${get("ai_language")}`);
  if (get("ai_behavior_rules")) parts.push(`REGOLE COMPORTAMENTALI:\n${get("ai_behavior_rules")}`);
  if (get("ai_style_instructions")) parts.push(`ISTRUZIONI STILE: ${get("ai_style_instructions")}`);
  if (get("ai_sector_notes")) parts.push(`NOTE SETTORE: ${get("ai_sector_notes")}`);

  if (parts.length === 0) return "";
  return `\n\nPROFILO UTENTE E AZIENDA:\n${parts.join("\n")}`;
}

// ━━━ Load Mission History ━━━

export async function loadMissionHistory(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("outreach_missions")
      .select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary, created_at, completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!data?.length) return "";
    let block = "\n\n--- STORICO MISSIONI RECENTI ---\n";
    for (const m of data as Record<string, unknown>[]) {
      const filters = m.target_filters as Record<string, unknown> | null;
      const countries = Array.isArray(filters?.countries) ? (filters.countries as string[]).join(", ") : "N/D";
      const progress = `${m.processed_contacts}/${m.total_contacts}`;
      block += `- "${m.title}" [${m.status}] — ${m.channel} — Paesi: ${countries} — Progresso: ${progress}`;
      if (m.ai_summary) block += ` — Riepilogo: ${String(m.ai_summary).substring(0, 100)}`;
      block += `\n`;
    }
    return block;
  } catch (e: unknown) {
    console.warn("loadMissionHistory failed:", extractErrorMessage(e));
    return "";
  }
}

// ━━━ Load KB Context ━━━

export async function loadKBContext(
  supabase: SupabaseClient,
  query?: string,
  userId?: string,
  contextTags?: { tags: string[]; categories: string[]; priority_boost: number },
): Promise<string> {
  const parts: string[] = [];
  const seenIds = new Set<string>();

  // ── LEVEL 1: Contextual tag-based loading ──
  if (contextTags && (contextTags.tags.length > 0 || contextTags.categories.length > 0)) {
    try {
      let q = supabase
        .from("kb_entries")
        .select("id, title, content, category, tags, priority")
        .eq("is_active", true);

      // user or system entries
      if (userId) {
        q = q.or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        q = q.is("user_id", null);
      }

      if (contextTags.categories.length > 0) {
        q = q.in("category", contextTags.categories);
      }
      if (contextTags.tags.length > 0) {
        q = q.overlaps("tags", contextTags.tags);
      }

      q = q.order("priority", { ascending: false }).limit(8);
      const { data } = await q;

      if (data?.length) {
        for (const e of data as Record<string, unknown>[]) seenIds.add(e.id as string);
        const entries = (data as Record<string, unknown>[])
          .map((e) => `### ${e.title} [${(Array.isArray(e.tags) ? e.tags.join(", ") : e.category) || ""}]\n${e.content}`)
          .join("\n\n");
        parts.push(`KNOWLEDGE BASE CONTESTUALE (tags: ${contextTags.tags.join(", ")}):\n${entries}`);
      }
    } catch (e: unknown) {
      console.warn("Context tag KB loading failed:", extractErrorMessage(e));
    }
  }

  // ── LEVEL 2: RAG semantic retrieval ──
  if (query && query.trim().length >= 8) {
    try {
      const { ragSearchKb } = await import("../_shared/embeddings.ts");
      const ragCount = seenIds.size > 0 ? 4 : 8;
      const matches = await ragSearchKb(supabase, query, {
        matchCount: ragCount, matchThreshold: 0.25, minPriority: 3, onlyActive: true,
      });
      const filtered = matches.filter((e: Record<string, unknown>) => !seenIds.has(e.id as string));
      if (filtered.length > 0) {
        const entries = filtered
          .map((e: Record<string, unknown>) => `### ${e.title} [sim=${(e.similarity as number).toFixed(2)} · ${(Array.isArray(e.tags) ? e.tags.join(", ") : e.category) || ""}]\n${e.content}`)
          .join("\n\n");
        parts.push(`KNOWLEDGE BASE AZIENDALE (RAG retrieval):\n${entries}`);
      }
    } catch (e: unknown) {
      console.warn("RAG retrieval failed:", extractErrorMessage(e));
    }
  }

  // ── LEVEL 3: Fallback by priority ──
  if (parts.length === 0) {
    const { data } = await supabase
      .from("kb_entries")
      .select("id, title, content, category, tags")
      .eq("is_active", true)
      .gte("priority", 5)
      .or(userId ? `user_id.eq.${userId},user_id.is.null` : "user_id.is.null")
      .order("priority", { ascending: false })
      .limit(10);

    if (data?.length) {
      for (const e of data as Record<string, unknown>[]) seenIds.add(e.id as string);
      const entries = (data as Record<string, unknown>[])
        .map((e) => `### ${e.title} [${(Array.isArray(e.tags) ? e.tags.join(", ") : e.category) || ""}]\n${e.content}`)
        .join("\n\n");
      parts.push(`KNOWLEDGE BASE AZIENDALE:\n${entries}`);
    }
  }

  if (parts.length === 0) return "";

  // Track KB access counts (fire-and-forget)
  if (seenIds.size > 0) {
    supabase.rpc("increment_kb_access", { entry_ids: Array.from(seenIds) })
      .then(() => {})
      .catch((e: unknown) => console.warn("increment_kb_access failed:", extractErrorMessage(e)));
  }

  return "\n\n" + parts.join("\n\n");
}

// ━━━ Load System Doctrine (always loaded, not query-dependent) ━━━

export async function loadSystemDoctrine(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("kb_entries")
    .select("title, content, tags, priority")
    .eq("category", "system_doctrine")
    .eq("is_active", true)
    .is("user_id", null)
    .order("priority", { ascending: false })
    .limit(10);

  if (!data?.length) return "";

  const entries = (data as Record<string, unknown>[]).map(e =>
    `### ${e.title}\n${e.content}`
  ).join("\n\n");

  return `\n\nDOTTRINA OPERATIVA (Knowledge Base Sistema):\n${entries}`;
}

// ━━━ Load Operative Prompts ━━━

export async function loadOperativePrompts(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("operative_prompts")
    .select("name, objective, procedure, criteria")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(5);

  if (!data?.length) return "";

  const prompts = (data as Record<string, unknown>[]).map(p =>
    `**${p.name}**: Obiettivo: ${p.objective}. Procedura: ${p.procedure}. Criteri: ${p.criteria}`
  ).join("\n");

  return `\n\nPROMPT OPERATIVI ATTIVI:\n${prompts}`;
}

// ━━━ Load Memory Context (Tiered L1/L2/L3 + Semantic RAG) ━━━

export async function loadMemoryContext(supabase: SupabaseClient, userId: string, query?: string): Promise<string> {
  const typeEmoji: Record<string, string> = { preference: "⭐", decision: "🎯", fact: "📌", conversation: "💬" };

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

// ━━━ Rolling Summary (ChatMemory) ━━━

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
