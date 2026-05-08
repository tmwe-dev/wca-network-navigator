// Sprint 2 — Strato 2 (content), refresh conversation context, inbound triage.
// Estratto 1:1 da index.ts. Tutte fire-and-forget.

import { runInboundTriage, maybeDispatchAlert } from "../../_shared/inboundTriage.ts";
import type { RequestBody } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export async function runContentClassification(supabase: Sb, body: RequestBody): Promise<void> {
  if (body.channel !== "email") return;
  try {
    await supabase.functions.invoke("classify-inbound-content", {
      body: {
        message_id: body.message_id,
        from_address: body.from_address,
        subject: body.subject || "",
        body_text: body.body_text || "",
        partner_id: body.partner_id || null,
        user_id: body.user_id ?? null,
        emit_pending_actions: true,
      },
    });
  } catch (_e) { /* fail-safe */ }
}

export async function refreshConversationContext(supabase: Sb, body: RequestBody): Promise<void> {
  if (!body.user_id || (!body.partner_id && !body.from_address)) return;
  try {
    await supabase.functions.invoke("refresh-conversation-context", {
      body: {
        user_id: body.user_id,
        partner_id: body.partner_id ?? null,
        email_address: body.from_address ?? null,
        limit: 30,
      },
    });
  } catch (_e) { /* fail-safe */ }
}

export async function runTriageAndAlert(supabase: Sb, body: RequestBody): Promise<void> {
  if (body.channel !== "email" || !body.user_id) return;
  try {
    const triage = await runInboundTriage({
      supabase,
      userId: body.user_id,
      messageId: body.message_id,
      channel: body.channel,
      fromAddress: body.from_address,
      subject: body.subject || "",
      bodyText: body.body_text || "",
    });
    if (triage) {
      await maybeDispatchAlert(supabase, {
        userId: body.user_id,
        messageId: body.message_id,
        channel: body.channel,
        fromAddress: body.from_address,
        subject: body.subject || "",
        triage,
      });
    }
  } catch (_e) { /* fail-safe */ }
}