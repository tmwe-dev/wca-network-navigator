/**
 * postProcessing.ts — Post-sync operations: email rules and classification.
 */

import { extractErrorMessage } from "../_shared/handleEdgeError.ts";

interface MessageRecord {
  id?: string;
  from_address?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  partner_id?: string;
  raw_payload?: Record<string, unknown>;
}

export async function applyEmailRules(
  supabase: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  messages: MessageRecord[]
): Promise<void> {
  try {
    const newMsgIds = messages.map((m) => m.id as string).filter(Boolean);
    if (newMsgIds.length === 0) return;

    const { data: opRow } = await supabase
      .from("operators")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const opId = opRow?.id;
    if (!opId) return;

    // Invocazione asincrona: non blocca la response
    const ruleResp = await fetch(`${supabaseUrl}/functions/v1/apply-email-rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ operator_id: opId, message_ids: newMsgIds }),
    });

    if (!ruleResp.ok) {
      console.warn("[check-inbox] apply-email-rules failed:", ruleResp.status);
    } else {
      const ruleResult = await ruleResp.json();
      console.log("[check-inbox] apply-email-rules:", ruleResult);
    }
  } catch (rulesErr: unknown) {
    console.warn("[check-inbox] apply-email-rules error (non-blocking):", extractErrorMessage(rulesErr));
  }
}

export async function classifyInboundEmails(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  messages: MessageRecord[]
): Promise<void> {
  // Fire-and-forget: classify inbound emails (max 10 per sync to avoid overwhelming AI)
  try {
    const toClassify = messages
      .filter((m) => (m.raw_payload as Record<string, unknown>)?.direction === "inbound")
      .slice(0, 10); // Rate limiting: max 10 classifications per sync cycle

    if (toClassify.length === 0) return;

    // Fire each classification request asynchronously without awaiting
    for (const msg of toClassify) {
      const payload = msg.raw_payload as Record<string, unknown>;
      const classifyPayload = {
        user_id: userId,
        email_address: msg.from_address as string,
        subject: msg.subject as string,
        body: (msg.body_text as string) || (msg.body_html as string) || "",
        direction: "inbound",
        partner_id: (msg.partner_id as string) || undefined,
        contact_id: (payload?.contact_id as string) || undefined,
        source_activity_id: (payload?.source_activity_id as string) || undefined,
        sender_name: (payload?.sender_name as string) || undefined,
      };

      // Fire-and-forget: don't await, let it run in background
      fetch(`${supabaseUrl}/functions/v1/classify-email-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(classifyPayload),
      }).catch((err) => {
        console.warn(`[check-inbox] Failed to fire classify request for msg ${msg.id}:`, extractErrorMessage(err));
      });
    }

    console.log(`[check-inbox] Fired ${toClassify.length} classification requests (fire-and-forget)`);
  } catch (classErr: unknown) {
    console.warn("[check-inbox] classify-email-response fire error (non-blocking):", extractErrorMessage(classErr));
  }
}

export function buildResponsePayload(messages: MessageRecord[], maxUid: number, remainingCount: number, hasMore: boolean): Record<string, unknown> {
  const matched = messages.filter((m) => (m as Record<string, unknown>).source_type !== "unknown").length;

  return {
    success: true,
    total: messages.length,
    matched,
    unmatched: messages.length - matched,
    last_uid: maxUid,
    remaining: remainingCount,
    has_more: hasMore,
    messages: messages.map((m) => ({
      id: m.id,
      from: m.from_address,
      from_address: m.from_address,
      subject: m.subject,
      email_date: (m as Record<string, unknown>).email_date,
      source_type: (m as Record<string, unknown>).source_type,
      sender_name: (m.raw_payload as Record<string, unknown>)?.sender_name,
      date: (m.raw_payload as Record<string, unknown>)?.date,
      has_body: !!((m.body_text as string) || (m.body_html as string)),
      body_text: ((m.body_text as string) || "").slice(0, 500),
      body_html: ((m.body_html as string) || "").slice(0, 8000),
      body_text_length: (m.body_text as string)?.length || 0,
      body_html_length: (m.body_html as string)?.length || 0,
      raw_size: ((m as Record<string, unknown>).raw_size_bytes as number) || 0,
      raw_stored: !!((m as Record<string, unknown>).raw_storage_path),
    })),
  };
}
