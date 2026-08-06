/**
 * postProcessing.ts — Post-sync operations: email rules and classification.
 */

interface MessageRecord {
  id?: string;
  from_address?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  partner_id?: string;
  direction?: string;
  raw_payload?: Record<string, unknown>;
}

export async function applyEmailRules(
  supabase: import("./supabaseClient.ts").AnySupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  messages: MessageRecord[],
): Promise<void> {
  try {
    const newMsgIds = messages.map((m) => m.id as string).filter(Boolean);
    if (newMsgIds.length === 0) return;

    const { data: opRow } = await supabase.from("operators").select("id").eq("user_id", userId).maybeSingle();

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

    // Best-effort post-processing: the caller does not consume the response.
    void ruleResp;
  } catch {
    // Rules application must not block inbox synchronization.
  }
}

export async function classifyInboundEmails(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  messages: MessageRecord[],
): Promise<void> {
  // B5 (2026-07-25) — GATE PASSED, fallback DISATTIVATO di default.
  // Baseline 7d: postProcess 156 invocazioni / 156 dedup_hits = 100% (≥ 60%).
  // Trigger DB on_inbound_message copre 1230/1230 messaggi (100%, ≥ 95%).
  // Cron classify-emails-batch resta safety net (< 5% volume).
  // Feature flag reversibile: CLASSIFY_POSTPROCESS_FALLBACK_ENABLED=true riabilita.
  const enabled = (Deno.env.get("CLASSIFY_POSTPROCESS_FALLBACK_ENABLED") ?? "false").toLowerCase() === "true";
  if (!enabled) return;
  // Path legacy (mantenuto per rollback): fire-and-forget via classify-inbound-message.
  try {
    // FIX 2026-05-11: `direction` è top-level su channel_messages, NON dentro raw_payload.
    // Tutti i messages sintetizzati da check-inbox sono inbound (saveMessageToDb forza direction="inbound"),
    // quindi accettiamo qualsiasi messaggio senza direction esplicita = "outbound".
    const toClassify = messages.filter((m) => !m.direction || m.direction === "inbound").slice(0, 10);

    if (toClassify.length === 0) return;

    for (const msg of toClassify) {
      const payload = msg.raw_payload as Record<string, unknown>;
      const classifyPayload = {
        message_id: msg.id as string,
        activity_id: (payload?.source_activity_id as string) || null,
        channel: "email",
        body_text: (msg.body_text as string) || (msg.body_html as string) || "",
        from_address: msg.from_address as string,
        subject: (msg.subject as string) || "",
        partner_id: (msg.partner_id as string) || null,
        mission_id: (payload?.mission_id as string) || null,
        user_id: userId,
      };

      // Fire-and-forget: don't await, let it run in background
      fetch(`${supabaseUrl}/functions/v1/classify-inbound-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          "x-invoke-source": "check-inbox-postProcess",
        },
        body: JSON.stringify(classifyPayload),
      }).catch(() => undefined);
    }
  } catch {
    // Classification fallback is deliberately fail-open.
  }
}

export function buildResponsePayload(
  messages: MessageRecord[],
  maxUid: number,
  remainingCount: number,
  hasMore: boolean,
): Record<string, unknown> {
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
      raw_stored: !!(m as Record<string, unknown>).raw_storage_path,
    })),
  };
}
