import "../_shared/llmFetchInterceptor.ts";
/**
 * agent-prompt-refiner — Weekly cron that analyzes feedback and proposes
 * prompt improvements for active agents. Suggestions go to ai_pending_actions
 * for human review.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { z, safeParseAiJson } from "../_shared/aiJsonValidator.ts";

const RefinerSchema = z.object({
  has_suggestions: z.boolean(),
  summary: z.string().default(""),
  suggestions: z.array(z.unknown()).default([]),
});
const REFINER_FALLBACK = { has_suggestions: false, summary: "", suggestions: [] as unknown[] };

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // 1. Load negative feedback
    const { data: negativeMemories } = await supabase
      .from("ai_memory")
      .select("content, tags, created_at")
      .gte("created_at", weekAgo)
      .contains("tags", ["feedback_negativo"])
      .order("importance", { ascending: false })
      .limit(20);

    // 2. Load corrections
    const { data: corrections } = await supabase
      .from("ai_memory")
      .select("content, tags, created_at")
      .gte("created_at", weekAgo)
      .contains("tags", ["correzione_utente"])
      .order("importance", { ascending: false })
      .limit(20);

    // 3. Load repetitions
    const { data: repetitions } = await supabase
      .from("ai_memory")
      .select("content, tags, created_at")
      .gte("created_at", weekAgo)
      .contains("tags", ["ripetizione"])
      .limit(10);

    if (!negativeMemories?.length && !corrections?.length && !repetitions?.length) {
      return new Response(JSON.stringify({ message: "No feedback to process" }), {
        status: 200,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // 4. Load active agents
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, system_prompt, user_id")
      .eq("is_active", true);

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    let processedCount = 0;

    for (const agent of agents || []) {
      const analysisPrompt = `Analizza il feedback della settimana per l'agente "${agent.name}" e proponi modifiche SPECIFICHE al suo system prompt.

SYSTEM PROMPT ATTUALE (primi 2000 char):
${(agent.system_prompt || "").substring(0, 2000)}

FEEDBACK NEGATIVI (l'utente non era soddisfatto):
${negativeMemories?.map((m: Record<string, unknown>) => `- ${m.content}`).join("\n") || "Nessuno"}

CORREZIONI UTENTE (l'utente ha corretto l'AI):
${corrections?.map((m: Record<string, unknown>) => `- ${m.content}`).join("\n") || "Nessuna"}

RIPETIZIONI (l'utente ha dovuto ripetere):
${repetitions?.map((m: Record<string, unknown>) => `- ${m.content}`).join("\n") || "Nessuna"}

Rispondi SOLO in JSON valido:
{
  "has_suggestions": true,
  "suggestions": [
    {
      "section": "quale sezione del prompt modificare",
      "current_text": "testo attuale da cambiare (se esiste, altrimenti null)",
      "suggested_text": "testo suggerito da aggiungere o sostituire",
      "reason": "perché questo miglioramento"
    }
  ],
  "summary": "riassunto in 2 righe dei miglioramenti proposti"
}

Se non ci sono suggerimenti utili, rispondi: {"has_suggestions": false, "suggestions": [], "summary": "Nessun miglioramento necessario"}`;

      try {
        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI call failed for agent ${agent.name}:`, aiResponse.status);
          continue;
        }

        const result = await aiResponse.json();
        const content = result.choices?.[0]?.message?.content || "";

        const { data: parsed, isFallback } = safeParseAiJson(content, RefinerSchema, {
          fnName: "agent-prompt-refiner",
          model: "google/gemini-2.5-flash",
          fallback: REFINER_FALLBACK,
        });
        if (isFallback) {
          console.warn(`[agent-prompt-refiner] schema fallback for agent=${agent.name} → skipping`);
          continue;
        }

        if (parsed.has_suggestions && parsed.suggestions?.length > 0) {
          await supabase.from("ai_pending_actions").insert({
            user_id: agent.user_id,
            action_type: "prompt_refinement",
            confidence: 0.7,
            reasoning: parsed.summary,
            suggested_content: JSON.stringify(parsed.suggestions),
            status: "pending",
            source: "agent_prompt_refiner",
          });

          await supabase.from("supervisor_audit_log").insert({
            user_id: agent.user_id,
            actor_type: "system",
            actor_name: "agent-prompt-refiner",
            action_category: "threshold_adjusted",
            action_detail: parsed.summary,
            target_type: "agent",
            target_id: agent.id,
            target_label: agent.name,
            decision_origin: "system_cron",
            metadata: { suggestion_count: parsed.suggestions.length },
          });

          processedCount++;
        }
      } catch (e: unknown) {
        console.error(`Failed to process agent ${agent.name}:`, e instanceof Error ? e.message : String(e));
      }
    }

    return new Response(JSON.stringify({ success: true, agents_processed: processedCount }), {
      status: 200,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("agent-prompt-refiner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});
