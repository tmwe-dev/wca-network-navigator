/**
 * classify-inbound-content — Strato 2 del classificatore inbound.
 *
 * Legge il CONTENUTO della mail con contesto pieno (mittente, history,
 * holding pattern, profilo nostro, KB) e propone azioni concrete senza
 * eseguirle. Output → tabella `email_content_intelligence` (idempotente
 * per message_id) + opzionalmente `ai_pending_actions`.
 *
 * Invocato fail-safe da `classify-inbound-message` SOLO per channel=email.
 * Mai blocca il flusso legacy.
 *
 * NESSUN enum chiuso sui campi semantici (label, intent_summary,
 * suggested_actions). Le regole vivono nel prompt operativo
 * `content-intelligence` editabile via Prompt Lab.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import { normalizeContent } from "../_shared/contentNormalizer.ts";
import { safeWrap } from "../_shared/promptSanitizer.ts";
import { loadConversationSummary } from "../_shared/conversationSummaryLoader.ts";
import { resolveCaller, assertMessageOwned } from "../_shared/ownership.ts";

interface RequestBody {
  message_id: string;
  from_address: string;
  subject?: string;
  body_text?: string;
  partner_id?: string | null;
  user_id?: string | null;
  /** Se true, ricalcola anche se già presente. */
  force?: boolean;
  /** Se true, materializza suggested_actions in ai_pending_actions (Step 2). */
  emit_pending_actions?: boolean;
}

const SuggestedActionSchema = z.object({
  type: z.string().min(1).max(40),
  label: z.string().max(120).optional(),
  color: z.string().max(20).optional(),
  title: z.string().max(200).optional(),
  due_in_hours: z.number().min(0).max(720).optional(),
  assignee_role: z.string().max(40).optional(),
  next: z.string().max(60).optional(),
  reason: z.string().max(400).optional(),
  template_hint: z.string().max(80).optional(),
}).passthrough();

const NextStepSchema = z.object({
  action_type: z.string().min(1).max(40),
  owner_role: z.string().max(40).default("operator"),
  urgency: z.string().max(20).default("medium"),
  due_in_hours: z.number().min(0).max(720).default(24),
  reason: z.string().max(400).default(""),
  status: z.string().max(20).default("open"),
}).passthrough();

const ResultSchema = z.object({
  content_label: z.string().min(1).max(160),
  intent_summary: z.string().max(400).default(""),
  business_value: z.string().max(20).default("none"),
  urgency: z.string().max(20).default("normal"),
  target_role: z.string().max(40).default("none"),
  continuity: z.object({
    campaign_id: z.string().nullable().optional(),
    thread_with_partner: z.boolean().optional(),
  }).passthrough().default({}),
  reasoning: z.string().max(600).default(""),
  confidence: z.number().min(0).max(1).default(0),
  suggested_actions: z.array(SuggestedActionSchema).max(8).default([]),
  next_step: NextStepSchema.optional().nullable(),
  closure_reason: z.string().max(80).optional().nullable(),
});

type Result = z.infer<typeof ResultSchema>;

function emptyResult(reason: string): Result {
  return {
    content_label: "(non classificato)",
    intent_summary: "",
    business_value: "none",
    urgency: "normal",
    target_role: "none",
    continuity: {},
    reasoning: reason,
    confidence: 0,
    suggested_actions: [{ type: "badge", label: "Da rivedere", color: "gray" }],
  };
}

/** Recupera contesto sintetico: profilo nostro, partner, ultime interazioni, holding. */
async function buildContextSummary(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string | null | undefined,
  partnerId: string | null | undefined,
  fromAddress: string,
) {
  const out: Record<string, unknown> = {};

  // Profilo nostro (system_doctrine, lazy)
  if (userId) {
    try {
      const { data: doctrine } = await supabase
        .from("system_doctrine")
        .select("title,body")
        .eq("user_id", userId)
        .limit(3);
      if (doctrine?.length) {
        out.our_profile = doctrine.map((d: { title: string; body: string }) =>
          `${d.title}: ${(d.body ?? "").slice(0, 200)}`).join("\n");
      }
    } catch (_) { /* fail-safe */ }
  }

  // Partner (passaporto)
  let pid = partnerId ?? null;
  if (!pid && fromAddress) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .or(`email.eq.${fromAddress},email_secondary.eq.${fromAddress}`)
        .limit(1)
        .maybeSingle();
      if (partner?.id) pid = partner.id;
    } catch (_) { /* fail-safe */ }
  }
  if (pid) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("id,company_name,country,role,lead_status,reliability_score,notes")
        .eq("id", pid)
        .maybeSingle();
      if (partner) out.partner = partner;
    } catch (_) { /* fail-safe */ }

    // Holding pattern
    try {
      const { data: holding } = await supabase
        .from("partner_outreach_state")
        .select("step_index,last_outreach_at,active_campaign_id,status")
        .eq("partner_id", pid)
        .maybeSingle();
      if (holding) out.holding_pattern = holding;
    } catch (_) { /* tabella opzionale */ }

    // Riassunto relazione (summary persistente o fallback 5 msg).
    // NON leggiamo più 30 mail raw: il summary è la guida.
    try {
      const sum = await loadConversationSummary(supabase, userId ?? null, {
        partnerId: pid,
        emailAddress: fromAddress,
        fallbackLimit: 5,
      });
      if (sum.block) {
        out.relationship_summary = sum.block;
        out.relationship_source = sum.source;
      }
    } catch (_) { /* fail-safe */ }
  }

  return { context: out, partner_id: pid };
}

function renderContext(ctx: Record<string, unknown>): string {
  const parts: string[] = [];
  if (ctx.our_profile) parts.push(`PROFILO NOSTRO:\n${ctx.our_profile}`);
  if (ctx.partner) parts.push(`PASSAPORTO MITTENTE:\n${JSON.stringify(ctx.partner)}`);
  if (ctx.holding_pattern) parts.push(`HOLDING PATTERN:\n${JSON.stringify(ctx.holding_pattern)}`);
  if (ctx.relationship_summary) parts.push(String(ctx.relationship_summary));
  return parts.join("\n\n") || "(contesto non disponibile)";
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));
  const metrics = startMetrics("classify-inbound-content");

  try {
    const cors = getCorsHeaders(req.headers.get("origin"));
    const caller = await resolveCaller(req, cors);
    if (caller instanceof Response) {
      endMetrics(metrics, false, caller.status);
      return caller;
    }
    const body: RequestBody = (caller.bodyJson ?? {}) as RequestBody;
    if (!body.message_id || !body.from_address) {
      endMetrics(metrics, false, 400);
      return new Response(
        JSON.stringify({ error: "message_id+from_address required" }),
        { status: 400, headers },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // For user-JWT callers: force user_id = JWT sub + verify message ownership.
    // Service-role: trust body.user_id (trigger context).
    if (!caller.isService) {
      body.user_id = caller.userId;
      const ownErr = await assertMessageOwned(supabase, body.message_id, caller.userId, cors);
      if (ownErr) {
        endMetrics(metrics, false, ownErr.status);
        return ownErr;
      }
    }

    // Idempotenza
    const { data: existing } = await supabase
      .from("email_content_intelligence")
      .select("*")
      .eq("message_id", body.message_id)
      .maybeSingle();
    if (existing && !body.force) {
      endMetrics(metrics, true, 200);
      return new Response(
        JSON.stringify({ ok: true, intelligence: existing, cached: true }),
        { status: 200, headers },
      );
    }

    // Contesto
    const { context, partner_id } = await buildContextSummary(
      supabase, body.user_id ?? null, body.partner_id ?? null, body.from_address,
    );
    const contextBlock = renderContext(context);

    // Prompt operativo (editabile via Prompt Lab)
    let operativeBlock = "";
    if (body.user_id) {
      try {
        const op = await loadOperativePrompts(supabase, body.user_id, {
          scope: "general",
          extraContexts: ["content-intelligence"],
          extraTags: ["content", "inbound"],
          includeUniversal: true,
          limit: 4,
        });
        if (op.block) operativeBlock = op.block;
      } catch (_) { /* fail-safe */ }
    }

    // Normalizza + sanitizza contenuto inbound
    const subjNorm = normalizeContent(body.subject ?? "", { source: "email-inbound", maxChars: 300 }).text;
    const bodyNorm = normalizeContent(body.body_text ?? "", { source: "email-inbound", maxChars: 4000 });
    const wrappedBody = safeWrap(bodyNorm.text, "INBOUND BODY", {
      source: "email-inbound", policy: "redact",
    }).block;

    const systemPrompt = [
      "Sei il Content Intelligence Reader del CRM Funnemail.",
      "Leggi il CONTENUTO di una mail in arrivo con il contesto fornito e produci una proposta di lettura + azioni.",
      "NON eseguire nulla. NON inventare partner. Sii sobrio: meglio confidence bassa che claim falsi.",
      operativeBlock || "",
    ].filter(Boolean).join("\n\n");

    const userPrompt = [
      `${contextBlock}`,
      `MITTENTE: ${body.from_address}`,
      `OGGETTO: ${subjNorm || "(vuoto)"}`,
      `CORPO:`,
      wrappedBody,
      `\nUsa lo strumento classify_content per restituire la lettura.`,
    ].join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const model = "google/gemini-3-flash-preview";
    let result: Result = emptyResult("AI key missing");

    if (LOVABLE_API_KEY) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_content",
                description: "Restituisce la lettura intelligente del contenuto della mail.",
                parameters: {
                  type: "object",
                  properties: {
                    content_label: { type: "string", maxLength: 160, description: "Etichetta libera che descrive di cosa parla la mail" },
                    intent_summary: { type: "string", maxLength: 400 },
                    business_value: { type: "string", description: "high|medium|low|none" },
                    urgency: { type: "string", description: "critical|high|normal|low" },
                    target_role: { type: "string", description: "commercial|operational|administrative|none" },
                    continuity: {
                      type: "object",
                      properties: {
                        campaign_id: { type: ["string", "null"] },
                        thread_with_partner: { type: "boolean" },
                      },
                    },
                    reasoning: { type: "string", maxLength: 600 },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    suggested_actions: {
                      type: "array",
                      maxItems: 8,
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string", description: "badge|agenda|lead_status|draft_reply|..." },
                          label: { type: "string" },
                          color: { type: "string" },
                          title: { type: "string" },
                          due_in_hours: { type: "number" },
                          assignee_role: { type: "string" },
                          next: { type: "string" },
                          reason: { type: "string" },
                          template_hint: { type: "string" },
                        },
                        required: ["type"],
                      },
                    },
                    next_step: {
                      type: ["object", "null"],
                      description: "Obbligatorio se la mail richiede azione; altrimenti null e popolare closure_reason.",
                      properties: {
                        action_type: { type: "string" },
                        owner_role: { type: "string", description: "commercial|operations|admin|legal|operator" },
                        urgency: { type: "string", description: "low|medium|high|critical" },
                        due_in_hours: { type: "number" },
                        reason: { type: "string" },
                        status: { type: "string", description: "open|in_progress|blocked" },
                      },
                      required: ["action_type", "owner_role", "urgency", "due_in_hours", "reason", "status"],
                    },
                    closure_reason: {
                      type: ["string", "null"],
                      description: "Obbligatorio se non serve next_step (es. newsletter, spam, noise, out_of_scope).",
                    },
                  },
                  required: ["content_label", "urgency", "target_role", "confidence", "suggested_actions"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "classify_content" } },
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (args) {
            const parsed = ResultSchema.safeParse(JSON.parse(args));
            if (parsed.success) result = parsed.data;
            else result = emptyResult(`schema mismatch: ${parsed.error.message.slice(0, 200)}`);
          } else {
            result = emptyResult("no tool_call in AI response");
          }
        } else {
          result = emptyResult(`AI gateway ${resp.status}`);
        }
      } catch (e) {
        result = emptyResult(`AI exception: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Persist
    const row = {
      message_id: body.message_id,
      user_id: body.user_id ?? null,
      partner_id,
      from_address: body.from_address,
      content_label: result.content_label,
      intent_summary: result.intent_summary,
      business_value: result.business_value,
      urgency: result.urgency,
      target_role: result.target_role,
      continuity: result.continuity,
      reasoning: result.reasoning,
      confidence: result.confidence,
      suggested_actions: result.suggested_actions,
      model,
      context_summary: { keys: Object.keys(context) },
      pending_action_ids: [] as string[],
    };

    const pendingIds: string[] = [];
    // Step 2 opt-in: emette ai_pending_actions per azioni non-badge
    if (body.emit_pending_actions && body.user_id && result.confidence >= 0.5) {
      for (const action of result.suggested_actions) {
        if (action.type === "badge") continue;
        try {
          const { data: ins } = await supabase.from("ai_pending_actions").insert({
            user_id: body.user_id,
            partner_id,
            email_address: body.from_address,
            action_type: `content_intel:${action.type}`,
            action_payload: action,
            suggested_content: action.title ?? action.label ?? null,
            reasoning: result.reasoning,
            confidence: result.confidence,
            source: "content_intelligence",
            risk_level: action.type === "draft_reply" ? "PREPARE" :
                        action.type === "lead_status" ? "WRITE" :
                        action.type === "agenda" ? "WRITE" : "READ",
            autonomy_level: "suggest",
          }).select("id").maybeSingle();
          if (ins?.id) pendingIds.push(ins.id);
        } catch (_) { /* fail-safe */ }
      }
      row.pending_action_ids = pendingIds;
    }

    if (existing && body.force) {
      await supabase.from("email_content_intelligence").update(row).eq("message_id", body.message_id);
    } else {
      await supabase.from("email_content_intelligence").insert(row);
    }

    endMetrics(metrics, true, 200);
    return new Response(
      JSON.stringify({ ok: true, intelligence: row, pending_action_ids: pendingIds }),
      { status: 200, headers },
    );
  } catch (error: unknown) {
    logEdgeError("classify-inbound-content", error);
    endMetrics(metrics, false, 500);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers },
    );
  }
});