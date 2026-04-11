/**
 * ai-utility — Macro-function for lightweight AI utilities.
 * Routes by body.action: briefing | categorize | deep_search
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    const body = await req.json();
    const action = body.action || "briefing";

    switch (action) {
      case "briefing":
        return forwardToFunction("daily-briefing", body, req.headers);
      case "categorize":
        return forwardToFunction("categorize-content", body, req.headers);
      case "deep_search":
        return forwardToFunction("ai-deep-search-helper", body, req.headers);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e: any) {
    console.error("ai-utility error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
