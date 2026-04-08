/**
 * voice-brain-bridge — Webhook ElevenLabs ↔ Brain WCA
 *
 * Wave 5 — Vol. III "Voice Channel" §2 (Brain↔Voice contract).
 *
 * Architettura: Brain & Voice Skin
 * ────────────────────────────────
 * • L'agente ElevenLabs è solo uno SKIN vocale: non ha logica commerciale,
 *   non ha KB, non sa nulla del dominio WCA.
 * • Ad ogni turno utile (richiesta di senso, decisione, recupero info)
 *   l'agente 11Labs chiama questo webhook tramite la sua "Tool" Custom HTTP:
 *     POST /functions/v1/voice-brain-bridge
 *     Headers: x-bridge-secret: <VOICE_BRIDGE_SECRET>
 *     Body:    { intent, utterance, caller_context, transcript, external_call_id, agent_id }
 * • Il Brain WCA carica il playbook `voice_wca_partner_call` + le regole
 *   KB di canale voce (categoria voice_rules) e risponde con il contratto
 *   JSON definito in KB "Voice — Schema output JSON Brain→Voice":
 *     { say, actions, next_state, end_call, transfer_to_human, memory_to_save }
 * • L'agente 11Labs pronuncia `say` e ignora il resto (gli `actions` sono
 *   eseguiti server-side dal Brain in fire-and-forget).
 *
 * Auth: secret condiviso in header `x-bridge-secret` + service role per
 * scrittura `voice_call_sessions`. L'utente associato è
 * `VOICE_BRIDGE_USER_ID` (un service user dell'organizzazione).
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, AiGatewayError, mapErrorToResponse } from "../_shared/aiGateway.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIDGE_SECRET = Deno.env.get("VOICE_BRIDGE_SECRET") || "";
const BRIDGE_USER_ID = Deno.env.get("VOICE_BRIDGE_USER_ID") || "";

type IncomingTurn = {
  external_call_id?: string;
  agent_id?: string;
  intent?: string;
  utterance?: string;
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
  next_state:
    | "discovery"
    | "qualification"
    | "objection"
    | "closing"
    | "followup"
    | "end";
  end_call: boolean;
  transfer_to_human: boolean;
  memory_to_save: string | null;
};

function makeSafeReply(
  partial: Partial<VoiceReply>,
  fallbackSay: string,
): VoiceReply {
  const sayRaw = (partial.say || fallbackSay || "").toString().trim();
  // Strip markdown / URLs / code fences for TTS safety
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

async function loadVoiceContext(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  // Load the voice playbook prompt + voice_rules KB entries (tutti template)
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
  if (playbook?.prompt_template) {
    parts.push(`# PLAYBOOK\n${playbook.prompt_template}`);
  }
  if (Array.isArray(kb) && kb.length > 0) {
    parts.push(
      "# KB VOICE RULES\n" +
        kb
          .map((k) => `## ${k.title}\n${k.content}`)
          .join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

async function loadPartnerSnippet(
  supabase: ReturnType<typeof createClient>,
  partnerId?: string,
): Promise<string> {
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
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
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
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildUserPrompt(turn: IncomingTurn): string {
  const transcript = (turn.transcript || [])
    .slice(-8)
    .map((t) => `${t.role === "user" ? "Partner" : "Agente"}: ${t.text}`)
    .join("\n");
  return [
    turn.intent ? `INTENT RILEVATO: ${turn.intent}` : "INTENT: (non specificato)",
    turn.caller_context?.operator_briefing
      ? `BRIEFING OPERATORE: ${turn.caller_context.operator_briefing}`
      : "",
    transcript ? `CRONOLOGIA RECENTE:\n${transcript}` : "",
    turn.utterance ? `ULTIMO TURNO PARTNER: "${turn.utterance}"` : "",
    "",
    "Decidi il prossimo turno rispettando il contratto JSON. Una sola domanda. ≤40 parole nel campo say.",
  ]
    .filter(Boolean)
    .join("\n");
}

function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  // Strip code fences if model wrapped it
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Shared-secret auth (11Labs non ha JWT utente)
  const presented = req.headers.get("x-bridge-secret") || "";
  if (!BRIDGE_SECRET || presented !== BRIDGE_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!BRIDGE_USER_ID) {
    return new Response(
      JSON.stringify({ error: "voice_bridge_user_not_configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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

  // Upsert voice_call_sessions row
  let sessionId: string | null = null;
  try {
    if (turn.external_call_id) {
      const { data: existing } = await supabase
        .from("voice_call_sessions")
        .select("id, transcript")
        .eq("external_call_id", turn.external_call_id)
        .eq("user_id", BRIDGE_USER_ID)
        .maybeSingle();
      if (existing?.id) {
        sessionId = existing.id as string;
        const newTranscript = [
          ...((existing.transcript as unknown[]) || []),
          ...(turn.transcript || []),
        ].slice(-200);
        await supabase
          .from("voice_call_sessions")
          .update({ transcript: newTranscript })
          .eq("id", sessionId);
      } else {
        const { data: created } = await supabase
          .from("voice_call_sessions")
          .insert({
            user_id: BRIDGE_USER_ID,
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
  try {
    const result = await aiChat({
      models: ["google/gemini-2.5-flash", "openai/gpt-4o-mini"],
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
    if (e instanceof AiGatewayError) {
      console.error("aiChat failed:", e.message, e.kind);
    } else {
      console.error("aiChat unknown error:", (e as Error).message);
    }
    // Fall through to fallback reply
  }

  const reply = makeSafeReply(
    parsed || {},
    "Mi scuso, ho avuto un problema tecnico. Posso richiamarti tra qualche minuto?",
  );

  // Persist memory if requested + advance session status if end_call
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
      if (turn.caller_context?.partner_id) {
        memTags.push(`partner:${turn.caller_context.partner_id}`);
      }
      await supabase.from("ai_memory").insert({
        user_id: BRIDGE_USER_ID,
        memory_type: "voice_call_outcome",
        content: reply.memory_to_save,
        tags: memTags,
        importance: 6,
      });
    }
  } catch (e) {
    console.warn("voice post-actions failed:", (e as Error).message);
  }

  return new Response(
    JSON.stringify({ ...reply, _meta: { session_id: sessionId, model: modelUsed } }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
