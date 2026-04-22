/**
 * questionAndComplaintHandler.ts — Handling for question and complaint categories.
 * Extracted from postClassificationPipeline.ts
 */

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

export interface QuestionComplaintInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
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
 * QUESTION / REQUEST_INFO
 */
export async function handleQuestion(
  supabase: SupabaseClient,
  input: QuestionComplaintInput,
  result: PostClassificationResult,
) {
  const isUrgent = (input.urgency ?? 1) >= 4;
  const priority = isUrgent ? "critical" : "high";

  try {
    const actionPayload = enrichActionPayload(
      {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        urgency: input.urgency,
        suggested_action: isUrgent
          ? "Domanda urgente — risposta richiesta entro 24h"
          : "Domanda dal partner — prepara risposta appoggiandoti a KB",
      },
      input.emailAddressRule,
    );

    const { data: insertedAction } = await supabase
      .from("ai_pending_actions")
      .insert({
        user_id: input.userId,
        partner_id: input.partnerId || null,
        action_type: "reply_to_question",
        action_payload: actionPayload,
        status: "pending",
        priority,
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push(`pending_reply_question_${priority}`);

      generateReplyDraft(supabase, insertedAction.id, input, "reply_to_question").catch((e) => {
        console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
      });
    }
  } catch (e) {
    result.errors.push(`Question action failed: ${e}`);
  }

  if (input.partnerId) {
    const days = isUrgent ? 1 : 2;
    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `Rispondi a domanda di ${input.senderName || input.senderEmail}`,
        description: input.aiSummary || "Il partner ha posto una domanda. Risposta richiesta.",
        status: "pending",
        priority,
        due_date: new Date(Date.now() + days * 86400000).toISOString(),
        source_meta: {
          classification: input.category,
          urgency: input.urgency,
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push(`reminder_question_T+${days}`);
    } catch (e) {
      result.errors.push(`Question reminder failed: ${e}`);
    }
  }
}

/**
 * COMPLAINT
 */
export async function handleComplaint(
  supabase: SupabaseClient,
  input: QuestionComplaintInput,
  result: PostClassificationResult,
) {
  try {
    const actionPayload = enrichActionPayload(
      {
        sender: input.senderEmail,
        subject: input.subject,
        ai_summary: input.aiSummary,
        urgency: 5,
        suggested_action:
          "RECLAMO RICEVUTO — richiede attenzione immediata. Risposta entro 24h. Tono: empatico, risolutivo, MAI difensivo.",
      },
      input.emailAddressRule,
    );

    const { data: insertedAction } = await supabase
      .from("ai_pending_actions")
      .insert({
        user_id: input.userId,
        partner_id: input.partnerId || null,
        action_type: "handle_complaint",
        action_payload: actionPayload,
        status: "pending",
        priority: "critical",
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push("pending_complaint_critical");

      generateReplyDraft(supabase, insertedAction.id, input, "handle_complaint").catch((e) => {
        console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
      });
    }
  } catch (e) {
    result.errors.push(`Complaint action failed: ${e}`);
  }

  if (input.partnerId) {
    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `RECLAMO da ${input.senderName || input.senderEmail}`,
        description: input.aiSummary || "Reclamo ricevuto. Gestione urgente richiesta.",
        status: "pending",
        priority: "critical",
        due_date: new Date(Date.now() + 86400000).toISOString(),
        source_meta: {
          classification: "complaint",
          urgency: 5,
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push("reminder_complaint_T+1");
    } catch (e) {
      result.errors.push(`Complaint reminder failed: ${e}`);
    }
  }
}

/**
 * OUT OF OFFICE / AUTO-REPLY
 */
export async function handleOutOfOffice(
  supabase: SupabaseClient,
  input: QuestionComplaintInput,
  result: PostClassificationResult,
) {
  let returnDate: Date;
  if (input.category === "auto_reply" && input.aiSummary) {
    // Try to parse OOO date from summary if available
    returnDate = new Date(Date.now() + 7 * 86400000);
  } else {
    returnDate = new Date(Date.now() + 7 * 86400000);
  }

  const followUpDate = new Date(returnDate.getTime() + 86400000);

  if (input.partnerId) {
    try {
      const { data: pendingReminders } = await supabase
        .from("activities")
        .select("id, title, source_meta")
        .eq("partner_id", input.partnerId)
        .eq("user_id", input.userId)
        .eq("status", "pending")
        .eq("activity_type", "follow_up");

      if (pendingReminders?.length) {
        await supabase
          .from("activities")
          .update({ status: "cancelled", source_meta: { cancelled_reason: "ooo_detected" } })
          .in(
            "id",
            pendingReminders.map((r: { id: string }) => r.id),
          );
        result.actionsExecuted.push(`frozen_${pendingReminders.length}_reminders`);
      }
    } catch {
      // Non critico
    }

    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `Ricontatta ${input.senderName || input.senderEmail} (rientro da OOO)`,
        description: `Auto-reply rilevato. Ritorno previsto: ${returnDate.toLocaleDateString("it-IT")}. Follow-up programmato 1gg dopo ritorno.`,
        status: "pending",
        priority: "normal",
        due_date: followUpDate.toISOString(),
        scheduled_at: followUpDate.toISOString(),
        source_meta: {
          classification: "auto_reply",
          ooo_return_date: returnDate.toISOString(),
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push("reminder_post_ooo");
    } catch (e) {
      result.errors.push(`OOO reminder failed: ${e}`);
    }
  }
}
