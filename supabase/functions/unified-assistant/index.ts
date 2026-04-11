/**
 * unified-assistant — Macro-function routing all assistant scopes.
 * Routes by body.scope to the correct original function.
 * Phase 1: pure facade/router. Logic stays in original functions.
 * Phase 2 (future): inline logic from simpler scopes.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";

const SCOPE_TO_FUNCTION: Record<string, string> = {
  partner_hub: "ai-assistant",
  cockpit: "cockpit-assistant",
  contacts: "contacts-assistant",
  import: "import-assistant",
  extension: "extension-brain",
  strategic: "super-assistant",
};

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    const body = await req.json();
    const scope = body.scope || "partner_hub";
    const targetFn = SCOPE_TO_FUNCTION[scope];

    if (!targetFn) {
      return new Response(JSON.stringify({ error: `Unknown scope: ${scope}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip scope before forwarding — original functions don't expect it
    const { scope: _scope, ...forwardBody } = body;
    return forwardToFunction(targetFn, forwardBody, req.headers);
  } catch (e: any) {
    console.error("unified-assistant error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
