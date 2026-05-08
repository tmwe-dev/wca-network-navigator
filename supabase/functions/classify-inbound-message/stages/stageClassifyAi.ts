// Sprint 2 — Stage AI: LLM classification + insert reply_classifications +
// activity update + autopilot/needs_human side-effects.
// Estratto 1:1 da index.ts. Comportamento identico.

import { loadOperativePrompts } from "../../_shared/operativePromptsLoader.ts";
import {
  CLASSIFICATIONS,
  SENTIMENTS,
  URGENCIES,
  type ClassifyResult,
  type RequestBody,
} from "./types.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export async function runAiClassification(
  supabase: Sb,
  body: RequestBody,
): Promise<{ result: ClassifyResult; model: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const model = "google/gemini-3-flash-preview";
  const { message_id, channel, body_text, from_address, subject } = body;

  let result: ClassifyResult = {
    classification: "neutral",
    confidence: 0,
    sentiment: "neutral",
    urgency: "normal",
    intent: "",
    reasoning: "No API key available",
  };

  if (!LOVABLE_API_KEY) return { result, model };

  const channelHint = channel === "whatsapp"
    ? "This is a WhatsApp message (short, informal)."
    : channel === "linkedin"
    ? "This is a LinkedIn message (professional networking)."
    : "This is an email reply (business communication).";

  const fallbackSystemPrompt = `You are a B2B inbound message classifier for a logistics CRM.
${channelHint}

Classify the message and extract structured metadata using the provided tool.
Consider the channel context when evaluating tone and intent.`;

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
  const finalSystemPrompt = hasSystemFromLab
    ? `${channelHint}\n\n${promptLabBlock}`
    : `${fallbackSystemPrompt}${promptLabBlock ? `\n\n${promptLabBlock}` : ""}`;

  const { normalizeContent } = await import("../../_shared/contentNormalizer.ts");
  const { safeWrap } = await import("../../_shared/promptSanitizer.ts");
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
          classification: (CLASSIFICATIONS as readonly string[]).includes(parsed.classification) ? parsed.classification : "neutral",
          confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
          sentiment: (SENTIMENTS as readonly string[]).includes(parsed.sentiment) ? parsed.sentiment : "neutral",
          urgency: (URGENCIES as readonly string[]).includes(parsed.urgency) ? parsed.urgency : "normal",
          intent: String(parsed.intent || "").substring(0, 200),
          reasoning: String(parsed.reasoning || "").substring(0, 500),
        };
      }
    } else {
      result.reasoning = `AI error: ${aiResp.status}`;
      void message_id; // referenced for future log enrichment
    }
  } catch (aiErr) {
    result.reasoning = `AI exception: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`;
  }

  return { result, model };
}

export async function persistClassificationSideEffects(
  supabase: Sb,
  body: RequestBody,
  result: ClassifyResult,
  model: string,
): Promise<void> {
  const { message_id, activity_id, channel, from_address, subject, partner_id, mission_id } = body;

  // Insert reply_classifications
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

  // Update activity description
  if (activity_id) {
    await supabase.from("activities").update({
      description: `[${result.classification} ${(result.confidence * 100).toFixed(0)}% | ${result.sentiment}] ` +
        `${channel} from ${from_address}. Intent: ${result.intent}`,
    }).eq("id", activity_id);
  }

  // Autopilot: positive + mission autopilot → pending action
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

  // Needs human → escalate activity priority
  if (result.classification === "needs_human" && activity_id) {
    await supabase.from("activities").update({
      priority: "critical",
      status: "pending",
    }).eq("id", activity_id);
  }
}