/**
 * super-mario — AI Gateway unificato per il Command (e altri scope futuri).
 *
 * Pipeline:
 *   1. Auth + parse body
 *   2. Load identity (DB)
 *   3. Assemble KB (static + dynamic-by-intent + situational)
 *   4. Assemble memory (narrative + recent + last_tool_result)
 *   5. Build system prompt (runtime contract + identity + KB + memory + tools)
 *   6. Preflight audit
 *   7. LLM call (Lovable AI Gateway)
 *   8. Postflight audit (JSON shape)
 *   9. Hard guards (sanitize / forbid)
 *  10. Audit log redatto -> super_mario_invocations
 *  11. Risposta al client
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { loadIdentity } from "./identityLoader.ts";
import { loadToolCatalog, renderToolCatalog } from "./toolCatalog.ts";
import { assembleKb } from "./kbAssembler.ts";
import { assembleMemory, type ConversationTurn } from "./memoryAssembler.ts";
import {
  HARD_GUARDS_DESCRIPTION,
  RESPONSE_SCHEMA_DESCRIPTION,
} from "./runtimeContract.ts";
import { preflightAudit } from "./preflightAudit.ts";
import { postflightAudit } from "./postflightAudit.ts";
import { applyHardGuards } from "./hardGuards.ts";
import { logInvocation } from "./auditLogger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const SUMMARY_MODEL = "google/gemini-2.5-flash-lite";

interface InvokeBody {
  scope?: string;
  conversation_id?: string | null;
  user_message: string;
  turns?: ConversationTurn[];
  operator_memory?: string;
  model?: string;
}

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  const t0 = Date.now();
  const traceId = crypto.randomUUID();

  if (req.method !== "POST") {
    return jsonResp({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  // --- Auth (JWT locale, no getUser di rete) ---
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResp({ error: "missing_bearer" }, 401, corsHeaders);
  }
  const jwt = authHeader.slice(7);
  const userId = decodeJwtSub(jwt);
  if (!userId) return jsonResp({ error: "invalid_jwt" }, 401, corsHeaders);

  // --- Parse body ---
  let body: InvokeBody;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "invalid_json_body" }, 400, corsHeaders);
  }
  const userMessage = (body.user_message ?? "").trim();
  if (!userMessage) {
    return jsonResp({ error: "user_message_required" }, 400, corsHeaders);
  }
  const scope = body.scope ?? "command";
  const model = body.model ?? DEFAULT_MODEL;
  const conversationId = body.conversation_id ?? null;
  const turns = Array.isArray(body.turns) ? body.turns : [];

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  // --- Identity + KB + Memory + Tools ---
  const identity = await loadIdentity(supabase, scope === "command" ? "command-director" : scope);
  const kb = await assembleKb({ supabase, userId, userRequest: userMessage });
  const memory = await assembleMemory({
    supabase,
    conversationId,
    turns,
    currentUserRequest: userMessage,
    operatorMemory: body.operator_memory,
    modelForSummary: SUMMARY_MODEL,
  });
  const catalog = loadToolCatalog(scope === "command" ? "command" : scope);
  const toolBlock = renderToolCatalog(catalog);

  // --- Build system prompt (ordine canonico) ---
  const systemPrompt = [
    "=== RUNTIME CONTRACT ===",
    RESPONSE_SCHEMA_DESCRIPTION,
    "",
    HARD_GUARDS_DESCRIPTION,
    "",
    "=== IDENTITY ===",
    identity.content,
    "",
    kb.text,
    "",
    memory.text,
    "",
    toolBlock,
  ].join("\n");

  // --- Preflight ---
  const pre = preflightAudit(systemPrompt, userMessage);
  if (!pre.ok) {
    await logInvocation(supabase, {
      trace_id: traceId,
      conversation_id: conversationId,
      operator_id: null,
      scope,
      domain: kb.domain,
      system_prompt: systemPrompt,
      user_message: userMessage,
      response_text: "",
      tool_calls: [],
      loaded_kb_cards: kb.loaded_cards,
      violations: [],
      preflight_warnings: pre.warnings,
      latency_ms: Date.now() - t0,
      model,
      ok: false,
      failure_reason: pre.reason ?? "preflight_failed",
    });
    return jsonResp({ error: "preflight_failed", reason: pre.reason }, 400, corsHeaders);
  }

  // --- LLM call (Lovable AI Gateway) ---
  let rawText = "";
  let promptTokens = 0;
  let completionTokens = 0;
  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!aiResp.ok) {
      const errBody = await aiResp.text();
      throw new Error(`ai_gateway_${aiResp.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await aiResp.json();
    rawText = data?.choices?.[0]?.message?.content ?? "";
    promptTokens = data?.usage?.prompt_tokens ?? 0;
    completionTokens = data?.usage?.completion_tokens ?? 0;
  } catch (e) {
    const reason = (e as Error).message;
    await logInvocation(supabase, {
      trace_id: traceId,
      conversation_id: conversationId,
      operator_id: null,
      scope,
      domain: kb.domain,
      system_prompt: systemPrompt,
      user_message: userMessage,
      response_text: "",
      tool_calls: [],
      loaded_kb_cards: kb.loaded_cards,
      violations: [],
      preflight_warnings: pre.warnings,
      latency_ms: Date.now() - t0,
      model,
      ok: false,
      failure_reason: reason,
    });
    return jsonResp({ error: "ai_call_failed", reason }, 502, corsHeaders);
  }

  // --- Postflight (JSON shape) ---
  const post = postflightAudit(rawText);
  if (!post.ok || !post.parsed) {
    await logInvocation(supabase, {
      trace_id: traceId,
      conversation_id: conversationId,
      operator_id: null,
      scope,
      domain: kb.domain,
      system_prompt: systemPrompt,
      user_message: userMessage,
      response_text: rawText,
      tool_calls: [],
      loaded_kb_cards: kb.loaded_cards,
      violations: [],
      preflight_warnings: pre.warnings,
      latency_ms: Date.now() - t0,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      model,
      ok: false,
      failure_reason: post.reason ?? "postflight_failed",
    });
    return jsonResp({ error: "postflight_failed", reason: post.reason, raw: rawText.slice(0, 500) }, 502, corsHeaders);
  }

  // --- Hard guards (sanitize) ---
  const guards = applyHardGuards(post.parsed, catalog);
  const finalResponse = guards.sanitized;

  // --- Audit log ---
  const latency = Date.now() - t0;
  await logInvocation(supabase, {
    trace_id: traceId,
    conversation_id: conversationId,
    operator_id: null,
    scope,
    domain: kb.domain,
    system_prompt: systemPrompt,
    user_message: userMessage,
    response_text: rawText,
    tool_calls: finalResponse.tool_calls,
    loaded_kb_cards: kb.loaded_cards,
    violations: guards.violations,
    preflight_warnings: pre.warnings,
    latency_ms: latency,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    model,
    ok: guards.ok,
    failure_reason: guards.ok ? undefined : "hard_guards_blocked",
  });

  return jsonResp(
    {
      trace_id: traceId,
      domain: kb.domain,
      response: finalResponse,
      meta: {
        latency_ms: latency,
        kb_cards: kb.loaded_cards.length,
        violations: guards.violations,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
    },
    200,
    corsHeaders,
  );
});

function jsonResp(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeJwtSub(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
