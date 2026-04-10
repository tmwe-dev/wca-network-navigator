/**
 * voice-brain-bridge — Webhook ElevenLabs ↔ Brain WCA
 *
 * Auth: per-session bridge token (hash-validated) OR legacy shared secret.
 * User ID: resolved from bridge_token creator or fallback service user.
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, AiGatewayError } from "../_shared/aiGateway.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIDGE_SECRET = Deno.env.get("VOICE_BRIDGE_SECRET") || "";

// Deterministic service user fallback (seeded by migration)
const SERVICE_USER_FALLBACK = "a0000000-0000-4000-a000-000000000b07";

type IncomingTurn = {
  external_call_id?: string;
  agent_id?: string;
  intent?: string;
  utterance?: string;
  bridge_token?: string;
  caller_context?: {
    partner_id?: string;
    contact_id?: string;
    phone?: string;
    operator_briefing?: string;
    [k: string]: unknown;
  };
  transcript?: Array<{ role: "user" | "agent"; text: string }>;
  direction?: "inbound" | "outbound";
};

type VoiceReply = {
  say: string;
  actions: Array<{ tool: string; params: Record<string, unknown> }>;
  next_state: "discovery" | "qualification" | "objection" | "closing" | "followup" | "end";
  end_call: boolean;
  transfer_to_human: boolean;
  memory_to_save: string | null;
};

function makeSafeReply(partial: Partial<VoiceReply>, fallbackSay: string): VoiceReply {
  const sayRaw = (partial.say || fallbackSay || "").toString().trim();
  const say = sayRaw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return {
    say,
    actions: Array.isArray(partial.actions) ? partial.actions.slice(0, 4) : [],
    next_state: (partial.next_state as VoiceReply["next_state"]) || "discovery",
    end_call: Boolean(partial.end_call),
    transfer_to_human: Boolean(partial.transfer_to_human),
    memory_to_save:
      typeof partial.memory_to_save === "string" && partial.memory_to_save.trim()
        ? partial.memory_to_save.trim()
        : null,
  };
}

/**
 * Validate bridge_token by hashing and looking up in bridge_tokens table.
 * Returns the created_by user_id if valid, null otherwise.
 */
async function validateBridgeToken(
  supabase: ReturnType<typeof createClient>,
  rawToken: string
): Promise<string | null> {
  if (!rawToken) return null;
  try {
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawToken)
    );
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data } = await supabase
      .from("bridge_tokens")
      .select("id, created_by, expires_at, used")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!data) return null;
    if (data.used) return null;
    if (new Date(data.expires_at as string) < new Date()) return null;

    // Mark as used
    await supabase
      .from("bridge_tokens")
      .update({ used: true })
      .eq("id", data.id);

    return data.created_by as string;
  } catch (e) {
    console.warn("bridge token validation failed:", (e as Error).message);
    return null;
  }
}

async function loadVoiceContext(supabase: ReturnType<typeof createClient>): Promise<string> {
  const [{ data: playbook }, { data: kb }] = await Promise.all([
    supabase
      .from("commercial_playbooks")
      .select("name, prompt_template, kb_tags")
      .eq("code", "voice_wca_partner_call")
      .eq("is_template", true)
      .maybeSingle(),
    supabase
      .from("kb_entries")
      .select("title, content, priority")
      .eq("category", "voice_rules")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(20),
  ]);

  const parts: string[] = [];
  if (playbook?.prompt_template) parts.push(`# PLAYBOOK\n${playbook.prompt_template}`);
  if (Array.isArray(kb) && kb.length > 0) {
    parts.push("# KB VOICE RULES\n" + kb.map((k) => `## ${k.title}\n${k.content}`).join("\n\n"));
  }
  return parts.join("\n\n");
}

async function loadPartnerSnippet(supabase: ReturnType<typeof createClient>, partnerId?: string): Promise<string> {
  if (!partnerId) return "";
  try {
    const { data } = await supabase
      .from("partners")
      .select("id, name, country_code, services, lead_status, rating, notes")
      .eq("id", partnerId)
      .maybeSingle();
    if (!data) return "";
    return [
      "# PARTNER IN LINEA",
      `Nome: ${data.name}`,
      data.country_code ? `Paese: ${data.country_code}` : "",
      data.services ? `Servizi: ${JSON.stringify(data.services).slice(0, 240)}` : "",
      data.lead_status ? `Lead status: ${data.lead_status}` : "",
      data.rating ? `Rating: ${data.rating}` : "",
      data.notes ? `Note: ${String(data.notes).slice(0, 240)}` : "",
    ].filter(Boolean).join("\n");
  } catch { return ""; }
}

function buildSystemPrompt(voiceContext: string, partnerSnippet: string): string {
  return [
    "Sei il Brain AI di WCA Network Navigator in modalità CANALE VOCE (ElevenLabs).",
    "Il tuo output viene parlato da un TTS: deve rispettare il contratto JSON.",
    "",
    "CONTRATTO DI USCITA — restituisci SOLO un oggetto JSON valido, nessun testo prima/dopo:",
    `{
  "say": "string ≤40 parole, parlato naturale, niente markdown/URL/codici",
  "actions": [{"tool":"string","params":{}}],
  "next_state": "discovery|qualification|objection|closing|followup|end",
  "end_call": false,
  "transfer_to_human": false,
  "memory_to_save": "string|null"
}`,
    "",
    voiceContext,
    partnerSnippet,
  ].filter(Boolean).join("\n\n");
}

function buildUserPrompt(turn: IncomingTurn): string {
  const transcript = (turn.transcript || [])
    .slice(-8)
    .map((t) => `${t.role === "user" ? "Partner" : "Agente"}: ${t.text}`)
    .join("\n");
  return [
    turn.intent ? `INTENT RILEVATO: ${turn.intent}` : "INTENT: (non specificato)",
    turn.caller_context?.operator_briefing ? `BRIEFING OPERATORE: ${turn.caller_context.operator_briefing}` : "",
    transcript ? `CRONOLOGIA RECENTE:\n${transcript}` : "",
    turn.utterance ? `ULTIMO TURNO PARTNER: "${turn.utterance}"` : "",
    "",
    "Decidi il prossimo turno rispettando il contratto JSON. Una sola domanda. ≤40 parole nel campo say.",
  ].filter(Boolean).join("\n");
}

function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
    return null;
  }
}

async function logRequest(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>): Promise<void> {
  try { await supabase.from("request_logs").insert(payload); } catch (e) { console.warn("request_logs insert failed:", (e as Error).message); }
}

async function logAiRequest(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>): Promise<void> {
  try { await supabase.from("ai_request_log").insert(payload); } catch (e) { console.warn("ai_request_log insert failed:", (e as Error).message); }
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const t0 = Date.now();
  const traceId = crypto.randomUUID();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let turn: IncomingTurn;
  try {
    turn = (await req.json()) as IncomingTurn;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // === AUTH: per-session bridge_token (primary) OR legacy shared secret (fallback) ===
  let resolvedUserId: string = SERVICE_USER_FALLBACK;

  if (turn.bridge_token) {
    const tokenUserId = await validateBridgeToken(supabase, turn.bridge_token);
    if (!tokenUserId) {
      return new Response(JSON.stringify({ error: "invalid_or_expired_bridge_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    resolvedUserId = tokenUserId;
  } else {
    // Legacy: shared secret in header
    const presented = req.headers.get("x-bridge-secret") || "";
    if (!BRIDGE_SECRET || presented !== BRIDGE_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use service user fallback for legacy auth
  }

  // Upsert voice_call_sessions row
  let sessionId: string | null = null;
  try {
    if (turn.external_call_id) {
      const { data: existing } = await supabase
        .from("voice_call_sessions")
        .select("id, transcript")
        .eq("external_call_id", turn.external_call_id)
        .eq("user_id", resolvedUserId)
        .maybeSingle();
      if (existing?.id) {
        sessionId = existing.id as string;
        const newTranscript = [
          ...((existing.transcript as unknown[]) || []),
          ...(turn.transcript || []),
        ].slice(-200);
        await supabase.from("voice_call_sessions").update({ transcript: newTranscript }).eq("id", sessionId);
      } else {
        const { data: created } = await supabase
          .from("voice_call_sessions")
          .insert({
            user_id: resolvedUserId,
            external_call_id: turn.external_call_id,
            agent_id: turn.agent_id || null,
            partner_id: turn.caller_context?.partner_id || null,
            contact_id: turn.caller_context?.contact_id || null,
            direction: turn.direction || "outbound",
            status: "active",
            caller_context: turn.caller_context || {},
            transcript: turn.transcript || [],
          })
          .select("id")
          .single();
        sessionId = (created?.id as string) || null;
      }
    }
  } catch (e) {
    console.warn("voice_call_sessions upsert failed:", (e as Error).message);
  }

  // Build prompt
  const [voiceCtx, partnerSnippet] = await Promise.all([
    loadVoiceContext(supabase),
    loadPartnerSnippet(supabase, turn.caller_context?.partner_id),
  ]);
  const systemPrompt = buildSystemPrompt(voiceCtx, partnerSnippet);
  const userPrompt = buildUserPrompt(turn);

  let parsed: Record<string, unknown> | null = null;
  let modelUsed = "";
  let aiStatus: "ok" | "error" | "timeout" = "ok";
  let aiErrorMessage: string | null = null;
  const aiT0 = Date.now();
  try {
    const result = await aiChat({
      models: ["google/gemini-2.5-flash", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
      timeoutMs: 12000,
      maxRetries: 1,
      context: `voice-brain-bridge:${(turn.external_call_id || "no-id").slice(0, 16)}`,
    });
    modelUsed = result.modelUsed || "";
    parsed = safeJsonParse(result.content || "");
  } catch (e) {
    aiStatus = "error";
    if (e instanceof AiGatewayError) {
      console.error("aiChat failed:", e.message, e.kind);
      aiErrorMessage = `${e.kind}: ${e.message}`;
      if (e.kind === "timeout") aiStatus = "timeout";
    } else {
      console.error("aiChat unknown error:", (e as Error).message);
      aiErrorMessage = (e as Error).message;
    }
  }
  const aiLatency = Date.now() - aiT0;

  void logAiRequest(supabase, {
    trace_id: traceId,
    user_id: resolvedUserId,
    agent_code: turn.agent_id || "voice_unknown",
    channel: "voice",
    model: modelUsed || "unknown",
    latency_ms: aiLatency,
    status: aiStatus,
    intent: turn.intent || null,
    error_message: aiErrorMessage,
    routed_to: "voice-brain-bridge",
    metadata: { external_call_id: turn.external_call_id || null },
  });

  const reply = makeSafeReply(
    parsed || {},
    "Mi scuso, ho avuto un problema tecnico. Posso richiamarti tra qualche minuto?",
  );

  // Persist memory + advance session
  try {
    if (sessionId) {
      const patch: Record<string, unknown> = {};
      if (reply.end_call) {
        patch.status = "completed";
        patch.ended_at = new Date().toISOString();
        patch.outcome = reply.memory_to_save || null;
      } else if (reply.transfer_to_human) {
        patch.status = "transferred";
        patch.ended_at = new Date().toISOString();
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("voice_call_sessions").update(patch).eq("id", sessionId);
      }
    }
    if (reply.memory_to_save) {
      const memTags = ["voice", "elevenlabs"];
      if (turn.caller_context?.partner_id) memTags.push(`partner:${turn.caller_context.partner_id}`);
      await supabase.from("ai_memory").insert({
        user_id: resolvedUserId,
        memory_type: "voice_call_outcome",
        content: reply.memory_to_save,
        tags: memTags,
        importance: 6,
      });
    }
  } catch (e) {
    console.warn("voice post-actions failed:", (e as Error).message);
  }

  const totalLatency = Date.now() - t0;
  void logRequest(supabase, {
    trace_id: traceId,
    user_id: resolvedUserId,
    function_name: "voice-brain-bridge",
    channel: "voice",
    http_status: 200,
    status: aiStatus === "ok" ? "ok" : aiStatus,
    latency_ms: totalLatency,
    error_code: aiStatus === "ok" ? null : aiStatus,
    error_message: aiErrorMessage,
    metadata: {
      external_call_id: turn.external_call_id || null,
      agent_id: turn.agent_id || null,
      session_id: sessionId,
    },
  });

  return new Response(
    JSON.stringify({
      ...reply,
      _meta: { session_id: sessionId, model: modelUsed, trace_id: traceId },
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "x-trace-id": traceId,
      },
    },
  );
});
