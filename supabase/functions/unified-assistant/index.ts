/**
 * unified-assistant — Single entry point for all assistant scopes.
 * Routes all scopes to ai-assistant (the main engine with platform tools).
 * Phase 2: proxy assistants eliminated, all scopes go to ai-assistant.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";

const VALID_SCOPES = new Set([
  "partner_hub", "cockpit", "contacts", "import", "extension", "strategic",
]);

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    const body = await req.json();
    const scope = body.scope || "partner_hub";

    if (!VALID_SCOPES.has(scope)) {
      return new Response(JSON.stringify({ error: `Unknown scope: ${scope}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All scopes route to ai-assistant (the main engine)
    // Scope is passed through so ai-assistant can adjust behavior
    return forwardToFunction("ai-assistant", body, req.headers);
  } catch (e: any) {
    console.error("unified-assistant error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
