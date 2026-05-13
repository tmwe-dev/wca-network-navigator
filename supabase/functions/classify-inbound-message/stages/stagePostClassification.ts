// Sprint 2 — Post-classification (EmailProcessManager + dispatchFunnemail).
// Estratto 1:1 da index.ts. Comportamento identico, fail-safe.

import { swallowedError } from "../../_shared/swallowedError.ts";
import { initEmailProcessManager } from "../../_shared/processManagers/emailProcessManager.ts";
import { initLeadProcessManager } from "../../_shared/processManagers/leadProcessManager.ts";
import { dispatchFunnemail } from "../../_shared/funnemailDispatcher.ts";
import { mapInboundToEmailCategory, type ClassifyResult, type RequestBody } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export async function runEmailProcessManager(
  supabase: Sb,
  body: RequestBody,
  result: ClassifyResult,
): Promise<unknown> {
  if (!body.user_id) return null;
  try {
    const mappedCategory = mapInboundToEmailCategory(result.classification);
    const _leadPM = initLeadProcessManager(supabase);
    const emailPM = initEmailProcessManager(supabase);
    const pmResult = await emailPM.processClassification({
      messageId: body.message_id || crypto.randomUUID(),
      userId: body.user_id,
      partnerId: body.partner_id || null,
      category: mappedCategory,
      confidence: result.confidence,
      senderEmail: body.from_address,
      subject: body.subject || undefined,
      aiSummary: result.intent || undefined,
      urgency: result.urgency || undefined,
      sentiment: result.sentiment || undefined,
      channel: (body.channel as "email" | "whatsapp" | "linkedin") || "email",
      bodyPreview: (body.body_text || "").slice(0, 600) || undefined,
    });
    return pmResult.pipelineResult;
  } catch (pcErr) {
    swallowedError("classify_inbound_message.post_classification_failed", pcErr);
    return null;
  }
}

export async function runFunnemailDispatcher(
  supabase: Sb,
  body: RequestBody,
  result: ClassifyResult,
): Promise<unknown> {
  if (body.channel !== "email") return null;
  try {
    return await dispatchFunnemail({
      supabase,
      messageId: body.message_id,
      userId: body.user_id,
      channel: body.channel,
      fromAddress: body.from_address,
      subject: body.subject || "",
      bodyText: body.body_text || "",
      partnerId: body.partner_id || null,
      classification: result.classification,
      confidence: result.confidence,
      intent: result.intent,
      sentiment: result.sentiment,
      urgency: result.urgency,
    });
  } catch (_e) {
    return null;
  }
}