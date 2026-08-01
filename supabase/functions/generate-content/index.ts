/**
 * generate-content — Macro-function for all content generation.
 * Routes by body.action: email | outreach | improve | analyze_edit
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  // Auth check before forwarding
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
      status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const action = body.action || "email";

    // Forward to original functions (they contain complex logic)
    switch (action) {
      case "email":
        return forwardToFunction("generate-email", body, req.headers);
      case "outreach":
        return forwardToFunction("generate-outreach", body, req.headers);
      case "improve":
        return forwardToFunction("improve-email", body, req.headers);
      case "analyze_edit":
        return forwardToFunction("analyze-email-edit", body, req.headers);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
        });
    }
  } catch (e: unknown) {
    console.error("generate-content error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || "Unknown error" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
