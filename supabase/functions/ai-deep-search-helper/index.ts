/**
 * ai-deep-search-helper — server-side wrapper per chiamate AI Gateway leggere
 * usate dal Deep Search client (useDeepSearchLocal). Sostituisce l'uso del
 * Bearer Lovable lato client (Vol. II §6.2 secrets management).
 *
 * Input: { prompt: string, model?: string }
 * Output: { content: string | null }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview",
  "openai/gpt-4o-mini",
]);

const MAX_PROMPT_LEN = 8000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth (bearer JWT del cliente Supabase) ──
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
    const model = typeof body.model === "string" && ALLOWED_MODELS.has(body.model)
      ? body.model
      : DEFAULT_MODEL;

    if (!prompt || prompt.length === 0) {
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

    // ── Server-side gateway call ──
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("[ai-deep-search-helper] LOVABLE_API_KEY missing");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 256,
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited", content: null }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted", content: null }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ai-deep-search-helper] gateway ${resp.status}:`, errText.substring(0, 300));
      return new Response(JSON.stringify({ error: "gateway_error", content: null }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string | null = data?.choices?.[0]?.message?.content?.trim() || null;
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-deep-search-helper] unexpected:", msg);
    return new Response(JSON.stringify({ error: "internal", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
