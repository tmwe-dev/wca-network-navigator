/**
 * ai-deep-search-helper — server-side wrapper per chiamate AI Gateway leggere
 * usate dal Deep Search client (useDeepSearchLocal).
 *
 * Vol. II §6.2 (secrets), §10.3 (resilience).
 *
 * Input: { prompt: string, model?: string }
 * Output: { content: string | null, usage, modelUsed, latencyMs }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, AiGatewayError, ALLOWED_MODELS, mapErrorToResponse } from "../_shared/aiGateway.ts";

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const MAX_PROMPT_LEN = 8000;

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    // ── Auth (JWT del cliente Supabase) ──
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Input validation ──
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const requestedModel = typeof body.model === "string" ? body.model : DEFAULT_MODEL;
    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Empty prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return new Response(JSON.stringify({ error: `Prompt too long (max ${MAX_PROMPT_LEN})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Centralized gateway call (retry, timeout, fallback) ──
    const result = await aiChat({
      models: [model, "openai/gpt-4o-mini"],
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
      timeoutMs: 20000,
      maxRetries: 1,
      context: `deep-search-helper:${user.id.substring(0, 8)}`,
    });

    return new Response(JSON.stringify({
      content: result.content,
      usage: result.usage,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return mapErrorToResponse(err, corsHeaders);
  }
});
