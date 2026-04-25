import "../_shared/llmFetchInterceptor.ts";
/**
 * reply-classifier — Classifies inbound email replies using LLM.
 * Invoked by pg_net from on_inbound_message_received trigger.
 *
 * Flow:
 *  1. Receive activity_id + message body
 *  2. LLM classifies: positive|negative|neutral|needs_human|spam
 *  3. Insert into reply_classifications
 *  4. If positive + mission autopilot → create agent_task
 *  5. If needs_human → create in-app notification
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

const VALID_CLASSIFICATIONS = ["positive", "negative", "neutral", "needs_human", "spam"] as const;
type Classification = typeof VALID_CLASSIFICATIONS[number];

interface RequestBody {
  activity_id: string;
  message_id: string;
  body_text: string;
  from_address: string;
  subject: string;
  partner_id: string | null;
  mission_id: string | null;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("reply-classifier");

  try {
    const body: RequestBody = await req.json();
    const { activity_id, message_id, body_text, from_address, subject, partner_id, mission_id } = body;

    if (!activity_id || !message_id) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "Missing activity_id or message_id" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ── LLM Classification ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let classification: Classification = "neutral";
    let confidence = 0;
    let reasoning = "No API key available";
    const model = "google/gemini-3-flash-preview";

    if (LOVABLE_API_KEY) {
      const systemPrompt = `You are an email reply classifier for a B2B logistics CRM.
Classify the reply into exactly one category:
- positive: interested, wants to proceed, asks for proposal/meeting
- negative: not interested, unsubscribe, rejection
- neutral: acknowledgment, general info, unclear intent
- needs_human: complex request, complaint, legal, requires human judgment
- spam: automated junk, unrelated marketing

Respond using the provided tool.`;

      const userPrompt = `From: ${from_address}
Subject: ${subject}
Body:
${(body_text || "").substring(0, 2000)}`;

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
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_reply",
                description: "Classify the email reply",
                parameters: {
                  type: "object",
                  properties: {
                    classification: { type: "string", enum: VALID_CLASSIFICATIONS },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    reasoning: { type: "string", maxLength: 500 },
                  },
                  required: ["classification", "confidence", "reasoning"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "classify_reply" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (VALID_CLASSIFICATIONS.includes(parsed.classification)) {
              classification = parsed.classification;
            }
            confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
            reasoning = String(parsed.reasoning || "").substring(0, 500);
          }
        } else {
          const errText = await aiResp.text();
          console.error("AI gateway error:", aiResp.status, errText);
          reasoning = `AI error: ${aiResp.status}`;
        }
      } catch (aiErr) {
        console.error("AI call failed:", aiErr);
        reasoning = `AI exception: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`;
      }
    }

    // ── Insert reply_classifications audit ──
    const { error: classErr } = await supabase.from("reply_classifications").insert({
      activity_id,
      classification,
      confidence,
      reasoning,
      model,
    });
    if (classErr) {
      console.error("Failed to insert reply_classification:", classErr);
    }

    // ── Update activity with classification info ──
    await supabase.from("activities").update({
      description: `[${classification} ${(confidence * 100).toFixed(0)}%] ` +
        `Reply from ${from_address}. ${reasoning}`,
    }).eq("id", activity_id);

    // ── Autopilot: if positive + mission has autopilot ──
    if (classification === "positive" && mission_id) {
      const { data: mission } = await supabase
        .from("outreach_missions")
        .select("autopilot, agent_id")
        .eq("id", mission_id)
        .maybeSingle();

      if (mission?.autopilot && mission.agent_id) {
        await supabase.from("agent_tasks").insert({
          agent_id: mission.agent_id,
          task_type: "send_proposal",
          status: "pending",
          context: {
            partner_id,
            from_address,
            subject,
            classification,
            mission_id,
            reply_activity_id: activity_id,
          },
        });
        
      }
    }

    // ── Needs human: create notification ──
    if (classification === "needs_human") {
      // Insert an in-app notification (uses existing notifications table if available)
      const { error: notifErr } = await supabase.from("notifications").insert({
        title: `Human review needed: ${subject || "(no subject)"}`,
        body: `Reply from ${from_address} requires human attention. Confidence: ${(confidence * 100).toFixed(0)}%`,
        type: "reply_needs_human",
        metadata: { activity_id, message_id, partner_id },
      }).select().maybeSingle();

      if (notifErr) {
        // Notifications table may not exist — log but don't fail
        console.warn("Could not create notification:", notifErr.message);
      }
    }

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({
      success: true,
      classification,
      confidence,
      activity_id,
    }), { status: 200, headers });

  } catch (error: unknown) {
    logEdgeError("reply-classifier", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
