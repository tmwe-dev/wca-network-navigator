// Sprint 2 — tipi e costanti condivisi tra gli stage di classify-inbound-message.
// Estratti 1:1 da index.ts per mantenere comportamento identico.

export const CLASSIFICATIONS = ["positive", "negative", "neutral", "needs_human", "spam"] as const;
export const SENTIMENTS = ["positive", "negative", "neutral", "mixed"] as const;
export const URGENCIES = ["critical", "high", "normal", "low"] as const;

export type ClassificationValue = typeof CLASSIFICATIONS[number];

export interface RequestBody {
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

export interface ClassifyResult {
  classification: ClassificationValue;
  confidence: number;
  sentiment: string;
  urgency: string;
  intent: string;
  reasoning: string;
}

// LOVABLE-93: Mapping da classificazione inbound a categoria postClassificationPipeline
export function mapInboundToEmailCategory(
  inboundClassification: ClassificationValue,
): "interested" | "not_interested" | "request_info" | "question" | "meeting_request" | "complaint" | "follow_up" | "auto_reply" | "unsubscribe" | "bounce" | "spam" | "uncategorized" {
  const mapping: Record<ClassificationValue, string> = {
    positive: "interested",
    negative: "not_interested",
    neutral: "follow_up",
    needs_human: "question",
    spam: "spam",
  };
  // deno-lint-ignore no-explicit-any
  return (mapping[inboundClassification] || "uncategorized") as any;
}

// LOVABLE-93: Converti urgency string a numero (1-5 scala per postClassificationPipeline)
export function mapUrgencyToNumber(urgencyStr: string | undefined): number | undefined {
  if (!urgencyStr) return undefined;
  const urgencyMap: Record<string, number> = {
    critical: 5,
    high: 4,
    normal: 2,
    low: 1,
  };
  return urgencyMap[urgencyStr] ?? 2;
}

// Helper fail-safe: registra lo stage corrente del job. Mai blocca.
// deno-lint-ignore no-explicit-any
export function makeRecordStage(supabase: any, messageId: string, userId: string | null) {
  return async (stage: string, payload: Record<string, unknown> = {}, error?: string) => {
    try {
      await supabase.rpc("record_email_processing_job_stage", {
        p_message_id: messageId,
        p_user_id: userId,
        p_stage: stage,
        p_payload: payload,
        p_error: error ?? null,
      });
    } catch (_e) { /* fail-safe */ }
  };
}