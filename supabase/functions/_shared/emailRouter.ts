/**
 * emailRouter.ts — Route post-classification actions by email category (commercial).
 * Extracted from postClassificationPipeline.ts
 */

import { applyLeadStatusChange } from "./leadStatusGuard.ts";
import { generateReplyDraft, enrichActionPayload, type EmailAddressRule } from "./classificationRules.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface PostClassificationResult {
  actionsExecuted: string[];
  statusChanged: boolean;
  pendingActionCreated: boolean;
  reminderCreated: boolean;
  errors: string[];
}

export interface RouterInput {
  userId: string;
  partnerId?: string | null;
  category: string;
  confidence: number;
  senderEmail: string;
  senderName?: string;
  subject?: string;
  aiSummary?: string;
  urgency?: number;
  sentiment?: string;
  emailAddressRule?: EmailAddressRule;
}

/**
 * INTERESTED / MEETING_REQUEST
 */
export async function handleInterested(
  supabase: SupabaseClient,
  input: RouterInput,
  result: PostClassificationResult,
) {
  const now = new Date().toISOString();

  // a) Escalate status
  if (input.partnerId) {
    const { data: partner } = await supabase
      .from("partners")
      .select("lead_status")
      .eq("id", input.partnerId)
      .maybeSingle();

    const current = partner?.lead_status || "new";
    let nextStatus: string | null = null;

    if (["new", "first_touch_sent"].includes(current)) nextStatus = "engaged";
    else if (current === "holding") nextStatus = "engaged";
    else if (current === "engaged" && input.category === "meeting_request")
      nextStatus = "qualified";
    else if (current === "qualified" && input.category === "meeting_request")
      nextStatus = "negotiation";

    if (nextStatus) {
      try {
        const res = await applyLeadStatusChange(supabase, {
          table: "partners",
          recordId: input.partnerId,
          newStatus: nextStatus,
          userId: input.userId,
          actor: { type: "system", name: "postClassificationPipeline" },
          decisionOrigin: "system_trigger",
          trigger: `Risposta ${input.category} (confidence ${(input.confidence * 100).toFixed(0)}%)`,
          metadata: {
            category: input.category,
            confidence: input.confidence,
            sender: input.senderEmail,
          },
        });
        if (res.applied) {
          result.statusChanged = true;
          result.actionsExecuted.push(`status_${current}_to_${nextStatus}`);
        }
      } catch (e) {
        result.errors.push(`Status change failed: ${e}`);
      }
    }
  }

  // b) Crea pending action per risposta
  const actionType =
    input.category === "meeting_request" ? "schedule_meeting" : "reply_interested";
  let pendingActionId: string | null = null;
  try {
    const actionPayload = enrichActionPayload(
      {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        suggested_action:
          input.category === "meeting_request"
            ? "Proponi disponibilità per call/meeting"
            : "Rispondi con prossimo passo concreto (Accompagnatore)",
      },
      input.emailAddressRule,
    );

    const { data: insertedAction } = await supabase
      .from("ai_pending_actions")
      .insert({
        user_id: input.userId,
        partner_id: input.partnerId || null,
        action_type: actionType,
        action_payload: actionPayload,
        status: "pending",
        priority: input.category === "meeting_request" ? "high" : "normal",
        reasoning: `Classificazione automatica: ${input.category} (${(input.confidence * 100).toFixed(0)}%)`,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      pendingActionId = insertedAction.id;
      result.pendingActionCreated = true;
      result.actionsExecuted.push(`pending_action_${actionType}`);

      if (actionType === "reply_interested") {
        generateReplyDraft(supabase, pendingActionId, {
          userId: input.userId,
          partnerId: input.partnerId,
          contactId: null,
          category: input.category,
          confidence: input.confidence,
          senderEmail: input.senderEmail,
          senderName: input.senderName,
          subject: input.subject,
          aiSummary: input.aiSummary,
          urgency: input.urgency,
          sentiment: input.sentiment,
          emailAddressRule: input.emailAddressRule,
        }, "reply_interested").catch((e) => {
          console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
        });
      }
    }
  } catch (e) {
    result.errors.push(`Pending action failed: ${e}`);
  }

  // c) Crea reminder rapido (T+1 per meeting, T+2 per interested)
  if (input.partnerId) {
    const days = input.category === "meeting_request" ? 1 : 2;
    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `Rispondi a ${input.senderName || input.senderEmail} (${input.category})`,
        description: input.aiSummary || `Partner ha risposto con interesse. Azione richiesta.`,
        status: "pending",
        priority: input.category === "meeting_request" ? "critical" : "high",
        due_date: new Date(Date.now() + days * 86400000).toISOString(),
        scheduled_at: new Date(Date.now() + days * 86400000).toISOString(),
        source_meta: {
          classification: input.category,
          confidence: input.confidence,
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push(`reminder_T+${days}`);
    } catch (e) {
      result.errors.push(`Reminder failed: ${e}`);
    }
  }
}

/**
 * NOT_INTERESTED
 */
export async function handleNotInterested(
  supabase: SupabaseClient,
  input: RouterInput,
  result: PostClassificationResult,
) {
  if (input.confidence < 0.8) {
    await supabase.from("ai_pending_actions").insert({
      user_id: input.userId,
      partner_id: input.partnerId || null,
      action_type: "review_not_interested",
      action_payload: {
        sender: input.senderEmail,
        subject: input.subject,
        ai_summary: input.aiSummary,
        confidence: input.confidence,
        suggested_action:
          "Confidence bassa: verificare manualmente se è davvero disinteressato",
      },
      status: "pending",
      priority: "normal",
    });
    result.pendingActionCreated = true;
    result.actionsExecuted.push("pending_review_low_confidence");
    return;
  }

  if (input.partnerId) {
    try {
      const res = await applyLeadStatusChange(supabase, {
        table: "partners",
        recordId: input.partnerId,
        newStatus: "archived",
        userId: input.userId,
        actor: { type: "system", name: "postClassificationPipeline" },
        decisionOrigin: "system_trigger",
        trigger: `Risposta not_interested (confidence ${(input.confidence * 100).toFixed(0)}%)`,
        metadata: {
          category: "not_interested",
          confidence: input.confidence,
          sender: input.senderEmail,
          ai_summary: input.aiSummary,
        },
      });
      if (res.applied) {
        result.statusChanged = true;
        result.actionsExecuted.push("status_to_archived");
      }
    } catch (e) {
      result.errors.push(`Archive failed: ${e}`);
    }

    try {
      await supabase
        .from("activities")
        .update({ status: "cancelled" })
        .eq("partner_id", input.partnerId)
        .eq("user_id", input.userId)
        .eq("status", "pending")
        .eq("activity_type", "follow_up");
      result.actionsExecuted.push("cancelled_pending_reminders");
    } catch {
      // Non critico
    }
  }

  const gracefulClosePayload = enrichActionPayload(
    {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      suggested_action:
        "Invia chiusura elegante (Chiusore): ringrazia, lascia porta aperta, nessuna pressione",
    },
    input.emailAddressRule,
  );

  try {
    const { data: insertedAction } = await supabase
      .from("ai_pending_actions")
      .insert({
        user_id: input.userId,
        partner_id: input.partnerId || null,
        action_type: "send_graceful_close",
        action_payload: gracefulClosePayload,
        status: "pending",
        priority: "low",
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push("pending_graceful_close");

      generateReplyDraft(supabase, insertedAction.id, {
        userId: input.userId,
        partnerId: input.partnerId,
        contactId: null,
        category: input.category,
        confidence: input.confidence,
        senderEmail: input.senderEmail,
        senderName: input.senderName,
        subject: input.subject,
        aiSummary: input.aiSummary,
        urgency: input.urgency,
        sentiment: input.sentiment,
        emailAddressRule: input.emailAddressRule,
      }, "send_graceful_close").catch((e) => {
        console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
      });
    }
  } catch (e) {
    result.errors.push(`Graceful close pending action failed: ${e}`);
  }
}

/**
 * FOLLOW_UP (dal partner)
 */
export async function handleFollowUp(
  supabase: SupabaseClient,
  input: RouterInput,
  result: PostClassificationResult,
) {
  if (input.partnerId) {
    await supabase
      .from("partners")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", input.partnerId);
  }

  if (input.partnerId) {
    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `Follow-up da ${input.senderName || input.senderEmail}`,
        description: input.aiSummary || "Il partner ha fatto follow-up. Rispondi per mantenere momentum.",
        status: "pending",
        priority: "normal",
        due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
        source_meta: {
          classification: "follow_up",
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push("reminder_follow_up_T+2");
    } catch (e) {
      result.errors.push(`Follow-up reminder failed: ${e}`);
    }
  }
}
