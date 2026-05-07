import "../_shared/llmFetchInterceptor.ts";
/**
 * classify-inbound-message — Universal inbound message classifier (email, whatsapp, linkedin).
 * Invoked by pg_net from on_inbound_message trigger.
 *
 * Replaces reply-classifier with multi-channel support and richer output schema.
 * LOVABLE-93: classificazione unificata multi-canale → postClassificationPipeline
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { swallowedError } from "../_shared/swallowedError.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { initEmailProcessManager } from "../_shared/processManagers/emailProcessManager.ts";
import { initLeadProcessManager } from "../_shared/processManagers/leadProcessManager.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import { checkInjectionGuard } from "../_shared/injectionGuard.ts";
import { dispatchFunnemail } from "../_shared/funnemailDispatcher.ts";
import { runInboundTriage, maybeDispatchAlert } from "../_shared/inboundTriage.ts";
import { resolveCaller, assertMessageOwned } from "../_shared/ownership.ts";

const CLASSIFICATIONS = ["positive", "negative", "neutral", "needs_human", "spam"] as const;
const SENTIMENTS = ["positive", "negative", "neutral", "mixed"] as const;
const URGENCIES = ["critical", "high", "normal", "low"] as const;

type ClassificationValue = typeof CLASSIFICATIONS[number];

// LOVABLE-93: Mapping da classificazione inbound a categoria postClassificationPipeline
function mapInboundToEmailCategory(
  inboundClassification: ClassificationValue,
): "interested" | "not_interested" | "request_info" | "question" | "meeting_request" | "complaint" | "follow_up" | "auto_reply" | "unsubscribe" | "bounce" | "spam" | "uncategorized" {
  const mapping: Record<ClassificationValue, string> = {
    positive: "interested",
    negative: "not_interested",
    neutral: "follow_up",
    needs_human: "question",
    spam: "spam",
  };
  return (mapping[inboundClassification] || "uncategorized") as any;
}

// LOVABLE-93: Converti urgency string a numero (1-5 scala per postClassificationPipeline)
function mapUrgencyToNumber(urgencyStr: string | undefined): number | undefined {
  if (!urgencyStr) return undefined;
  const urgencyMap: Record<string, number> = {
    critical: 5,
    high: 4,
    normal: 2,
    low: 1,
  };
  return urgencyMap[urgencyStr] ?? 2;
}

interface RequestBody {
  message_id: string;
  activity_id: string | null;
  channel: string;
  body_text: string;
  from_address: string;
  subject: string;
  partner_id: string | null;
  mission_id: string | null;
  user_id: string | null;
}

interface ClassifyResult {
  classification: ClassificationValue;
  confidence: number;
  sentiment: string;
  urgency: string;
  intent: string;
  reasoning: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("classify-inbound-message");

  try {
    // ── Auth + ownership ──
    // Accepts: user JWT (UI) OR service-role (trigger pg_net). Anon-key rejected.
    const corsHeadersOnly = corsH;
    const caller = await resolveCaller(req, corsHeadersOnly);
    if (caller instanceof Response) {
      endMetrics(metrics, false, caller.status);
      return caller;
    }
    const body: RequestBody = (caller.bodyJson ?? {}) as RequestBody;
    const { message_id, activity_id, channel, body_text, from_address, subject, partner_id, mission_id } = body;

    // For user-JWT callers: force user_id = JWT sub and verify message ownership.
    // For service-role (trigger): trust body.user_id (set by DB trigger from owning row).
    if (!caller.isService) {
      body.user_id = caller.userId;
      if (message_id) {
        const ownErr = await assertMessageOwned(
          // use a service client so RLS doesn't block the lookup
          createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } },
          ),
          message_id,
          caller.userId,
          corsHeadersOnly,
        );
        if (ownErr) {
          endMetrics(metrics, false, ownErr.status);
          return ownErr;
        }
      }
    }

    if (!message_id) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ── Idempotency guard ──
    // Il messaggio può essere classificato sia dal trigger DB on_inbound_message
    // sia dal fallback check-inbox/postProcessing. Se esiste già una riga
    // reply_classifications per questo message_id, ritorniamo senza ri-eseguire
    // AI/postClassificationPipeline/funnemail (evita doppi side-effect).
    {
      const { data: existingClass } = await supabase
        .from("reply_classifications")
        .select("id")
        .eq("message_id", message_id)
        .maybeSingle();
      if (existingClass) {
        endMetrics(metrics, true, 200);
        return new Response(
          JSON.stringify({ success: true, deduped: true, message_id }),
          { status: 200, headers },
        );
      }
    }

    // ── Anti-Prompt-Injection Guard ──
    // Se il testo inbound contiene pattern HIGH (override istruzioni, esfiltrazione
    // system prompt, jailbreak, ecc.) e c'è un utente proprietario, bloccare
    // l'elaborazione e creare una review che richiede conferma esplicita.
    // Senza user_id (chiamata da trigger DB) ci si affida al sanitizer downstream.
    if (body.user_id) {
      const reviewToken = req.headers.get("x-injection-review-id");
      const guard = await checkInjectionGuard(supabase, {
        userId: body.user_id,
        source: channel === "whatsapp" ? "whatsapp-message"
          : channel === "linkedin" ? "linkedin-message"
          : "email-inbound",
        functionName: "classify-inbound-message",
        text: `${subject || ""}\n\n${body_text || ""}`,
        reviewToken,
        metadata: { message_id, activity_id, channel, from_address },
      });
      if (guard.needsConfirmation) {
        endMetrics(metrics, true, 409);
        return new Response(
          JSON.stringify({
            error: "prompt_injection_review_required",
            review_id: guard.reviewId,
            findings: guard.findings,
            message_id,
            hint: "Approva la review via POST /confirm-injection-review e ritrasmetti la richiesta con header x-injection-review-id.",
          }),
          { status: 409, headers },
        );
      }
    }

    // ── LLM Classification ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const model = "google/gemini-3-flash-preview";
    let result: ClassifyResult = {
      classification: "neutral",
      confidence: 0,
      sentiment: "neutral",
      urgency: "normal",
      intent: "",
      reasoning: "No API key available",
    };

    if (LOVABLE_API_KEY) {
      const channelHint = channel === "whatsapp"
        ? "This is a WhatsApp message (short, informal)."
        : channel === "linkedin"
        ? "This is a LinkedIn message (professional networking)."
        : "This is an email reply (business communication).";

      // Fallback hardcoded — usato SOLO se il Prompt Lab non ha "Inbound Message System".
      const fallbackSystemPrompt = `You are a B2B inbound message classifier for a logistics CRM.
${channelHint}

Classify the message and extract structured metadata using the provided tool.
Consider the channel context when evaluating tone and intent.`;

      // Inject Prompt Lab rules: il system prompt principale è ora editabile come
      // "Inbound Message System" + le regole universali (Lead Qualification v2, ecc.).
      let promptLabBlock = "";
      let hasSystemFromLab = false;
      if (body.user_id) {
        try {
          const opResult = await loadOperativePrompts(supabase, body.user_id, {
            scope: "classification",
            channel: channel as "email" | "whatsapp" | "linkedin",
            extraTags: ["system", "inbound"],
            includeUniversal: true,
            limit: 6,
          });
          if (opResult.block) {
            promptLabBlock = opResult.block;
            hasSystemFromLab = (opResult.appliedNames ?? []).some((n) => n === "Inbound Message System");
          }
        } catch (e) {
          console.warn("[classify-inbound-message] prompt lab load failed:", (e as Error).message);
        }
      }
      // Se il Prompt Lab fornisce "Inbound Message System", usalo come system principale
      // (il channelHint resta sempre prepended). Altrimenti fallback hardcoded.
      const finalSystemPrompt = hasSystemFromLab
        ? `${channelHint}\n\n${promptLabBlock}`
        : `${fallbackSystemPrompt}${promptLabBlock ? `\n\n${promptLabBlock}` : ""}`;

      // Normalizza+sanitizza il contenuto inbound prima di iniettarlo nel prompt:
      // rimuove HTML, quoted-replies, firme, OCR/zero-width noise; poi anti-injection.
      const { normalizeContent } = await import("../_shared/contentNormalizer.ts");
      const { safeWrap } = await import("../_shared/promptSanitizer.ts");
      const channelSource: "email-inbound" | "whatsapp-message" | "linkedin-message" =
        channel === "whatsapp" ? "whatsapp-message"
        : channel === "linkedin" ? "linkedin-message"
        : "email-inbound";
      const subjNorm = normalizeContent(subject || "", { source: channelSource, maxChars: 300 }).text;
      const bodyNorm = normalizeContent(body_text || "", { source: channelSource, maxChars: 3000 });
      const { block: bodyBlock } = safeWrap(bodyNorm.text, "INBOUND BODY", {
        source: channelSource,
        policy: "redact",
      });

      const userPrompt = `Channel: ${channel}
From: ${from_address}
Subject: ${subjNorm || "(none)"}
Body:
${bodyBlock}`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: finalSystemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_message",
                description: "Classify the inbound message",
                parameters: {
                  type: "object",
                  properties: {
                    classification: { type: "string", enum: [...CLASSIFICATIONS] },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    sentiment: { type: "string", enum: [...SENTIMENTS] },
                    urgency: { type: "string", enum: [...URGENCIES] },
                    intent: { type: "string", maxLength: 200, description: "Brief description of sender's intent" },
                    reasoning: { type: "string", maxLength: 500 },
                  },
                  required: ["classification", "confidence", "sentiment", "urgency", "intent", "reasoning"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "classify_message" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            result = {
              classification: CLASSIFICATIONS.includes(parsed.classification) ? parsed.classification : "neutral",
              confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
              sentiment: SENTIMENTS.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
              urgency: URGENCIES.includes(parsed.urgency) ? parsed.urgency : "normal",
              intent: String(parsed.intent || "").substring(0, 200),
              reasoning: String(parsed.reasoning || "").substring(0, 500),
            };
          }
        } else {
          const errText = await aiResp.text();
          result.reasoning = `AI error: ${aiResp.status}`;
        }
      } catch (aiErr) {
        result.reasoning = `AI exception: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`;
      }
    }

    // ── Insert reply_classifications ──
    const { error: classErr } = await supabase.from("reply_classifications").insert({
      message_id,
      channel,
      classification: result.classification,
      confidence: result.confidence,
      sentiment: result.sentiment,
      urgency: result.urgency,
      intent: result.intent,
      reasoning: result.reasoning,
      model,
    });
    if (classErr) console.error("[classify-inbound] Insert error:", classErr);

    // ── Update activity description ──
    if (activity_id) {
      await supabase.from("activities").update({
        description: `[${result.classification} ${(result.confidence * 100).toFixed(0)}% | ${result.sentiment}] ` +
          `${channel} from ${from_address}. Intent: ${result.intent}`,
      }).eq("id", activity_id);
    }

    // ── Autopilot: positive + mission autopilot → pending action ──
    if (result.classification === "positive" && mission_id) {
      const { data: mission } = await supabase
        .from("outreach_missions")
        .select("autopilot, agent_id")
        .eq("id", mission_id)
        .maybeSingle();

      if (mission?.autopilot) {
        await supabase.from("ai_pending_actions").insert({
          user_id: body.user_id,
          action_type: "send_proposal",
          status: "pending",
          context: {
            partner_id,
            from_address,
            subject,
            channel,
            classification: result.classification,
            confidence: result.confidence,
            mission_id,
            message_id,
          },
        });
      }
    }

    // ── Needs human: create notification activity ──
    if (result.classification === "needs_human" && activity_id) {
      await supabase.from("activities").update({
        priority: "critical",
        status: "pending",
      }).eq("id", activity_id);
    }

    // ── Post-classification via EmailProcessManager (event-driven) ──
    let postClassResult = null;
    if (body.user_id) {
      try {
        const mappedCategory = mapInboundToEmailCategory(result.classification);
        // Init both PMs — LeadPM reacts to EmailPM's events automatically
        const leadPM = initLeadProcessManager(supabase);
        const emailPM = initEmailProcessManager(supabase);
        const pmResult = await emailPM.processClassification({
          messageId: body.message_id || crypto.randomUUID(),
          userId: body.user_id,
          partnerId: partner_id || null,
          category: mappedCategory,
          confidence: result.confidence,
          senderEmail: from_address,
          subject: subject || undefined,
          aiSummary: result.intent || undefined,
          urgency: result.urgency || undefined,
          sentiment: result.sentiment || undefined,
          channel: (channel as "email" | "whatsapp" | "linkedin") || "email",
        });
        postClassResult = pmResult.pipelineResult;
      } catch (pcErr) {
        swallowedError("classify_inbound_message.post_classification_failed", pcErr);
      }
    }

    // ── Funnemail policy dispatcher (solo email, fail-safe) ──
    let funnemailResult: unknown = null;
    if (channel === "email") {
      try {
        funnemailResult = await dispatchFunnemail({
          supabase,
          messageId: message_id,
          userId: body.user_id,
          channel,
          fromAddress: from_address,
          subject: subject || "",
          bodyText: body_text || "",
          partnerId: partner_id || null,
          classification: result.classification,
          confidence: result.confidence,
          intent: result.intent,
          sentiment: result.sentiment,
          urgency: result.urgency,
        });
      } catch (_e) {
        // dispatcher è fail-safe ma per sicurezza non rompiamo il return
      }
    }

    // ── Funnemail Inbox classifier (cartella + agenda + handoff). Fire-and-forget. ──
    if (channel === "email") {
      try {
        // 1) Scout sul mittente: solo se sconosciuto (no partner_id) o
        //    cache scaduta. La function gestisce internamente cache + match CRM.
        let senderIntel: unknown = null;
        try {
          const { data: scoutData } = await supabase.functions.invoke("funnemail-scout-sender", {
            body: {
              from_address,
              message_id,
              user_id: body.user_id ?? null,
              force: false,
            },
          });
          if (scoutData) {
            const sd = scoutData as { known?: boolean; partner_id?: string | null; intel?: Record<string, unknown> | null };
            senderIntel = {
              known: !!sd.known,
              partner_id: sd.partner_id ?? null,
              company_type: sd.intel?.company_type ?? null,
              country: sd.intel?.country ?? null,
              website: sd.intel?.website ?? null,
              role_guess: sd.intel?.role_guess ?? null,
            };
          }
        } catch (_se) {
          // scout fallito → procediamo senza intel
        }

        await supabase.functions.invoke("funnemail-classify", {
          body: {
            message_id,
            from_address,
            subject: subject || "",
            body_text: body_text || "",
            partner_id: partner_id || null,
            user_id: body.user_id ?? null,
            prior_classification: result.classification,
            prior_intent: result.intent,
            sender_intel: senderIntel,
          },
        });
      } catch (_e) {
        // fail-safe: la classificazione legacy resta valida anche senza Funnemail
      }
    }

    // ── Funnemail Auto-Route (gruppo mittente utente). Fire-and-forget. ──
    // Crea una email_address_rules se confidence >= 0.85 (auto-instrada anche le
    // prossime mail dello stesso mittente/dominio); altrimenti scrive solo un
    // suggerimento in channel_messages.ai_classification_suggestion.
    if (channel === "email" && body.user_id) {
      try {
        await supabase.functions.invoke("funnemail-auto-route", {
          body: {
            message_id,
            from_address,
            subject: subject || "",
            body_text: body_text || "",
            user_id: body.user_id,
          },
        });
      } catch (_e) {
        // fail-safe: routing è fire-and-forget, errori non bloccano nulla
      }
    }

    // ── Content Intelligence (Strato 2): legge il CONTENUTO con contesto
    //    pieno e propone azioni. Fire-and-forget, mai blocca il flusso legacy.
    if (channel === "email") {
      try {
        await supabase.functions.invoke("classify-inbound-content", {
          body: {
            message_id,
            from_address,
            subject: subject || "",
            body_text: body_text || "",
            partner_id: partner_id || null,
            user_id: body.user_id ?? null,
            // Step 2 ATTIVO: materializza suggested_actions in ai_pending_actions
            // (risk gate + two-phase commit garantiscono che WRITE/DELETE restino
            // bloccati dietro approvazione operatore).
            emit_pending_actions: true,
          },
        });
      } catch (_e) {
        // fail-safe
      }
    }

    // ── Refresh Conversation Summary (cross-canale).
    //    Fire-and-forget, debounced 5min nel target. Mai blocca.
    if (body.user_id && (partner_id || from_address)) {
      try {
        await supabase.functions.invoke("refresh-conversation-context", {
          body: {
            user_id: body.user_id,
            partner_id: partner_id ?? null,
            email_address: from_address ?? null,
            limit: 30,
          },
        });
      } catch (_e) {
        // fail-safe
      }
    }

    // ── Inbound Triage TMWE (categoria + urgenza 0-100) + alert WhatsApp ai
    //    responsabili. Fire-and-forget. Mai blocca classificazione legacy.
    if (channel === "email" && body.user_id) {
      try {
        const triage = await runInboundTriage({
          supabase,
          userId: body.user_id,
          messageId: message_id,
          channel,
          fromAddress: from_address,
          subject: subject || "",
          bodyText: body_text || "",
        });
        if (triage) {
          await maybeDispatchAlert(supabase, {
            userId: body.user_id,
            messageId: message_id,
            channel,
            fromAddress: from_address,
            subject: subject || "",
            triage,
          });
        }
      } catch (_e) {
        // fail-safe
      }
    }

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({
      success: true,
      classification: result.classification,
      confidence: result.confidence,
      sentiment: result.sentiment,
      urgency: result.urgency,
      channel,
      post_classification: postClassResult,
      funnemail: funnemailResult,
    }), { status: 200, headers });

  } catch (error: unknown) {
    logEdgeError("classify-inbound-message", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
