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
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { initEmailProcessManager } from "../_shared/processManagers/emailProcessManager.ts";
import { initLeadProcessManager } from "../_shared/processManagers/leadProcessManager.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";

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
    const body: RequestBody = await req.json();
    const { message_id, activity_id, channel, body_text, from_address, subject, partner_id, mission_id } = body;

    if (!message_id) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

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

      const systemPrompt = `You are a B2B inbound message classifier for a logistics CRM.
${channelHint}

Classify the message and extract structured metadata using the provided tool.
Consider the channel context when evaluating tone and intent.`;

      // Inject Prompt Lab rules (Lead Qualification v2 9-stati, channel rules).
      let promptLabBlock = "";
      if (body.user_id) {
        try {
          const opResult = await loadOperativePrompts(supabase, body.user_id, {
            scope: "classification",
            channel: channel as "email" | "whatsapp" | "linkedin",
            includeUniversal: true,
            limit: 5,
          });
          if (opResult.block) promptLabBlock = `\n\n${opResult.block}`;
        } catch (e) {
          console.warn("[classify-inbound-message] prompt lab load failed:", (e as Error).message);
        }
      }
      const finalSystemPrompt = systemPrompt + promptLabBlock;

      const userPrompt = `Channel: ${channel}
From: ${from_address}
Subject: ${subject || "(none)"}
Body:
${(body_text || "").substring(0, 3000)}`;

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
    }), { status: 200, headers });

  } catch (error: unknown) {
    logEdgeError("classify-inbound-message", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
