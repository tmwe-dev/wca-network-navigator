import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * ai-tracking-healthcheck — Verifica copertura tracking AI cost.
 *
 * Confronta funzioni LLM dichiarate vs funzioni che hanno effettivamente loggato
 * in `ai_prompt_log` negli ultimi 7 giorni.
 *
 * Output:
 *  {
 *    coveragePct: 95,
 *    totalLLMCalls7d: 1234,
 *    instrumentedCount: 28,
 *    expectedCount: 30,
 *    missingFunctions: ["xyz"],
 *    callsByFunction: { "agent-execute": 320, ... }
 *  }
 */

const EXPECTED_LLM_FUNCTIONS = [
  // Strumentate via aiChat
  "ai-arena-suggest", "ai-deep-search-helper", "analyze-email-edit",
  "classify-email-response", "country-kb-generator", "daily-briefing",
  "generate-email", "generate-outreach", "improve-email", "voice-brain-bridge",
  // Migrate via interceptor
  "agent-execute", "agent-loop", "agent-prompt-refiner", "agentic-decide",
  "ai-assistant", "ai-gateway-micro", "ai-match-business-cards",
  "ai-query-planner", "analyze-import-structure", "analyze-partner",
  "batch-enrichment-worker", "categorize-content", "classify-inbound-message",
  "enrich-partner-website", "generate-aliases", "linkedin-ai-extract",
  "optimus-analyze", "parse-business-card", "parse-profile-ai",
  "process-ai-import", "reply-classifier", "sherlock-extract",
  "suggest-email-groups", "whatsapp-ai-extract",
];

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req);

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supa
      .from("ai_prompt_log")
      .select("function_name")
      .gte("created_at", sevenDaysAgo);

    if (error) throw error;

    const callsByFunction: Record<string, number> = {};
    for (const row of data ?? []) {
      const fn = (row as { function_name: string }).function_name;
      callsByFunction[fn] = (callsByFunction[fn] ?? 0) + 1;
    }

    const instrumentedSet = new Set(Object.keys(callsByFunction));
    const missingFunctions = EXPECTED_LLM_FUNCTIONS.filter((f) => !instrumentedSet.has(f));
    const instrumentedCount = EXPECTED_LLM_FUNCTIONS.length - missingFunctions.length;
    const coveragePct = Math.round((instrumentedCount / EXPECTED_LLM_FUNCTIONS.length) * 100);

    return new Response(
      JSON.stringify({
        coveragePct,
        totalLLMCalls7d: (data ?? []).length,
        instrumentedCount,
        expectedCount: EXPECTED_LLM_FUNCTIONS.length,
        missingFunctions,
        callsByFunction,
        windowDays: 7,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
