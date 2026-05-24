// Sprint 2 — Stage AI: LLM classification + insert reply_classifications +
// activity update + autopilot/needs_human side-effects.
// Estratto 1:1 da index.ts. Comportamento identico.

import {
  CLASSIFICATIONS,
  SENTIMENTS,
  URGENCIES,
  type ClassifyResult,
  type RequestBody,
} from "./types.ts";
import { buildClassificationPrompt } from "./aiPromptBuilder.ts";
import { aiFetch } from "../../_shared/aiCallShim.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export async function runAiClassification(
  supabase: Sb,
  body: RequestBody,
): Promise<{ result: ClassifyResult; model: string }> {
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

  if (!LOVABLE_API_KEY) return { result, model };

  const { systemPrompt: finalSystemPrompt, userPrompt } = await buildClassificationPrompt(supabase, body);

  try {
    const aiResp = await aiFetch({
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