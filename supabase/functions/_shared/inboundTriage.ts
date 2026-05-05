/**
 * inboundTriage — chiama l'AI per classificare un inbound lungo 2 assi
 * (categoria business + urgenza 0-100) e, se serve, invoca dispatch-urgent-alert
 * fire-and-forget. Mai blocca il flusso legacy.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface TriageInput {
  supabase: SupabaseClient;
  userId: string;
  messageId: string;
  channel: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
}

export interface TriageResult {
  business_category: string;
  urgency_score: number;
  urgency_reason: string;
  priority_bucket: string;
  should_alert: boolean;
  alert_categories: string[];
  suggested_summary_for_alert: string;
}

export async function runInboundTriage(input: TriageInput): Promise<TriageResult | null> {
  // Solo email per ora (alert WhatsApp richiede contesto email).
  if (input.channel !== "email") return null;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  // Carica il prompt operativo "Inbound Triage TMWE" dal Prompt Lab.
  let promptBlock = "";
  try {
    const { loadOperativePrompts } = await import("./operativePromptsLoader.ts");
    const r = await loadOperativePrompts(input.supabase, input.userId, {
      scope: "classification",
      extraTags: ["triage", "tmwe", "alert_routing"],
      includeUniversal: true,
      limit: 4,
    });
    promptBlock = r.block;
  } catch (_) { /* fail-safe */ }

  const system = `Sei il triage operativo di TMWE / Find Air. Restituisci SOLO JSON valido conforme allo schema della tool call.
${promptBlock ? "\n" + promptBlock : ""}`;
  const user = `Channel: ${input.channel}
From: ${input.fromAddress}
Subject: ${(input.subject || "").slice(0, 240)}
Body:
${(input.bodyText || "").slice(0, 3000)}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "triage_inbound",
            parameters: {
              type: "object",
              properties: {
                business_category: {
                  type: "string",
                  enum: ["operations", "administrative", "commercial_demand", "commercial_supply", "informational", "system", "newsletter", "bounce"],
                },
                urgency_score: { type: "integer", minimum: 0, maximum: 100 },
                urgency_reason: { type: "string", maxLength: 240 },
                priority_bucket: {
                  type: "string",
                  enum: ["P1_urgent", "P2_commercial", "P3_standard_ops", "P4_supply", "P5_noise"],
                },
                should_alert: { type: "boolean" },
                alert_categories: {
                  type: "array",
                  items: { type: "string", enum: ["operations_urgent", "admin_urgent", "commercial_urgent"] },
                },
                suggested_summary_for_alert: { type: "string", maxLength: 280 },
              },
              required: ["business_category", "urgency_score", "urgency_reason", "priority_bucket", "should_alert", "alert_categories", "suggested_summary_for_alert"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "triage_inbound" } },
      }),
    });
    if (!resp.ok) {
      await resp.text();
      return null;
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args) as TriageResult;
    return parsed;
  } catch (_) {
    return null;
  }
}

export async function maybeDispatchAlert(
  supabase: SupabaseClient,
  args: {
    userId: string;
    messageId: string;
    channel: string;
    fromAddress: string;
    subject: string;
    triage: TriageResult;
  },
): Promise<void> {
  if (!args.triage.should_alert) return;
  if (!args.triage.alert_categories || args.triage.alert_categories.length === 0) return;
  try {
    await supabase.functions.invoke("dispatch-urgent-alert", {
      body: {
        user_id: args.userId,
        message_id: args.messageId,
        from_address: args.fromAddress,
        subject: args.subject,
        business_category: args.triage.business_category,
        urgency_score: args.triage.urgency_score,
        alert_categories: args.triage.alert_categories,
        summary: args.triage.suggested_summary_for_alert,
        channel: args.channel,
      },
    });
  } catch (_) { /* fail-safe */ }
}