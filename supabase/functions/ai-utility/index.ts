/**
 * ai-utility — Macro-function for lightweight AI utilities.
 * Routes by body.action: briefing | categorize | deep_search
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
          status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
        });
    }
  } catch (e: Record<string, unknown>) {
    console.error("ai-utility error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
