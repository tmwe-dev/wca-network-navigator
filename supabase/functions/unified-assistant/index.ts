/**
 * unified-assistant — Single entry point for all assistant scopes.
 * Routes all scopes to ai-assistant (the main engine with platform tools).
 * Phase 2: proxy assistants eliminated, all scopes go to ai-assistant.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { forwardToFunction } from "../_shared/proxyUtils.ts";

const VALID_SCOPES = new Set([
  "partner_hub", "cockpit", "contacts", "import", "extension", "strategic",
  "kb-supervisor",
]);

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
    const scope = body.scope || "partner_hub";

    if (!VALID_SCOPES.has(scope)) {
      return new Response(JSON.stringify({ error: `Unknown scope: ${scope}` }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Normalize: if body.message is a string and body.messages doesn't exist,
    // convert to messages array (fixes GlobalVoiceFAB sending { message: "..." })
    if (typeof body.message === "string" && !body.messages) {
      body.messages = [{ role: "user", content: body.message }];
      delete body.message;
    }

    // Propagate conversational mode to ai-assistant via context
    const mode: string = body.mode || "operative";
    if (mode === "conversational") {
      if (!body.context || typeof body.context !== "object") {
        body.context = {};
      }
      body.context.conversational = true;
      body.context.mode = "conversational";
    }

    // All scopes route to ai-assistant (the main engine)
    // Scope is passed through so ai-assistant can adjust behavior
    return forwardToFunction("ai-assistant", body, req.headers);
  } catch (e: unknown) {
    console.error("unified-assistant error:", e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
