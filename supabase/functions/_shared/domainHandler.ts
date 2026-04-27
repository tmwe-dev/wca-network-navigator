/**
 * domainHandler.ts — Domain-specific handlers (operative, administrative, support, internal).
 * Extracted from postClassificationPipeline.ts (LOVABLE-93 feature)
 */

import { enrichActionPayload, type EmailAddressRule } from "./classificationRules.ts";
import { applyLeadStatusChange } from "./leadStatusGuard.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface PostClassificationResult {
  actionsExecuted: string[];
  statusChanged: boolean;
  pendingActionCreated: boolean;
  reminderCreated: boolean;
  errors: string[];
}

export interface DomainHandlerInput {
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
 * OPERATIVE DOMAIN: quote_request, booking_request, rate_inquiry,
 *                   shipment_tracking, cargo_status, documentation_request
 */
export async function handleOperativeRequest(
  supabase: SupabaseClient,
  input: DomainHandlerInput,
  result: PostClassificationResult,
) {
  const now = new Date().toISOString();
  const category = input.category as string;

  if (input.partnerId) {
    try {
      await supabase
        .from("partners")
        .update({ last_interaction_at: now })
        .eq("id", input.partnerId);
    } catch (e) {
      result.errors.push(`Failed to update partner interaction: ${e}`);
    }
  }

  let actionType: string;
  let priority: "high" | "normal";
  let needsReminder = false;

  if (["quote_request", "booking_request", "rate_inquiry"].includes(category)) {
    actionType = "draft_quote_response";
    priority = "high";
    needsReminder = true;
  } else if (["shipment_tracking", "cargo_status"].includes(category)) {
    actionType = "provide_tracking_info";
    priority = "normal";
  } else if (category === "documentation_request") {
    actionType = "send_documentation";
    priority = "normal";
  } else {
    actionType = "operative_action";
    priority = "normal";
  }

  let currentLeadStatus: string | null = null;
  if (input.partnerId && ["quote_request", "booking_request", "rate_inquiry"].includes(category)) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", input.partnerId)
        .maybeSingle();

      currentLeadStatus = partner?.lead_status || null;
    } catch (e) {
      result.errors.push(`Failed to check conversion signal: ${e}`);
    }
  }

  const isConversionSignal = currentLeadStatus && ["negotiation", "qualified"].includes(currentLeadStatus);
  const isSoftSignalQualification = currentLeadStatus === "engaged" && ["quote_request", "booking_request", "rate_inquiry"].includes(category);

  // Re-engagement: partner in holding/first_touch_sent che invia richiesta operativa
  // ad alto intento (preventivo, booking, tariffa) → riportare a "engaged".
  // Chi chiede un preventivo dopo settimane di silenzio è chiaramente ri-coinvolto.
  const HIGH_INTENT_CATEGORIES = ["quote_request", "booking_request", "rate_inquiry"];
  const isReEngagementSignal = currentLeadStatus
    && ["holding", "first_touch_sent"].includes(currentLeadStatus)
    && HIGH_INTENT_CATEGORIES.includes(category);

  try {
    const actionPayload = enrichActionPayload(
      {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        domain: "operative",
        category,
        suggested_action: `Operative request: ${category}`,
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
        priority,
        reasoning: `Operative domain: ${category} (confidence ${(input.confidence * 100).toFixed(0)}%)`,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push(`operative_${actionType}`);
    }
  } catch (e) {
    result.errors.push(`Operative pending action failed: ${e}`);
  }

  if (isConversionSignal && currentLeadStatus && input.partnerId) {
    try {
      const { data: insertedConversionAction } = await supabase
        .from("ai_pending_actions")
        .insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          action_type: "confirm_conversion",
          action_payload: {
            trigger_category: category,
            signal_type: `${currentLeadStatus}_stage_operative_request`,
            current_lead_status: currentLeadStatus,
            conversion_trigger_summary: input.aiSummary,
            sender_email: input.senderEmail,
            suggested_action: "Conferma transizione a cliente e attiva gestione operativa",
          },
          status: "pending",
          priority: "high",
          reasoning: `Il contatto in fase "${currentLeadStatus}" ha inviato una richiesta operativa (${category}). Questo suggerisce una collaborazione avviata.`,
          created_at: now,
        })
        .select("id")
        .single();

      if (insertedConversionAction?.id) {
        result.actionsExecuted.push("operative_conversion_signal_pending");
      }
    } catch (e) {
      result.errors.push(`Conversion signal action failed: ${e}`);
    }
  }

  if (isSoftSignalQualification && input.partnerId) {
    try {
      await supabase.from("ai_pending_actions").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        action_type: "suggest_qualification",
        action_payload: {
          trigger_category: category,
          trigger_summary: input.aiSummary,
          sender_email: input.senderEmail,
          current_lead_status: "engaged",
          suggested_action: "Valuta la qualificazione di questo contatto — sta mostrando segnali operativi",
        },
        status: "pending",
        priority: "normal",
        reasoning: `Il contatto in fase "engaged" ha inviato una richiesta operativa (${category}). Consigliata valutazione per qualificazione.`,
        created_at: now,
      });

      result.actionsExecuted.push("operative_soft_signal_qualification");
    } catch (e) {
      result.errors.push(`Qualification suggestion failed: ${e}`);
    }
  }

  // Re-engagement: partner silente (holding/first_touch_sent) che invia richiesta
  // operativa ad alto intento → escalation automatica a "engaged".
  // Logica: chi chiede un preventivo/booking dopo settimane di silenzio è ri-coinvolto.
  // Usa applyLeadStatusChange per audit trail + validazione monotona.
  if (isReEngagementSignal && input.partnerId) {
    try {
      const res = await applyLeadStatusChange(supabase, {
        table: "partners",
        recordId: input.partnerId,
        newStatus: "engaged",
        userId: input.userId,
        actor: { type: "system", name: "domainHandler_reengagement" },
        decisionOrigin: "system_trigger",
        trigger: `Richiesta operativa "${category}" da partner in "${currentLeadStatus}" — segnale di ri-coinvolgimento`,
        metadata: {
          category,
          confidence: input.confidence,
          sender: input.senderEmail,
          previous_status: currentLeadStatus,
          signal_type: "operative_reengagement",
        },
      });
      if (res.applied) {
        result.statusChanged = true;
        result.actionsExecuted.push(`reengagement_${currentLeadStatus}_to_engaged`);
      }
    } catch (e) {
      result.errors.push(`Re-engagement escalation failed: ${e}`);
    }

    // Crea anche un'azione pending per notificare l'operatore del ri-coinvolgimento
    try {
      await supabase.from("ai_pending_actions").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        action_type: "reply_interested",
        action_payload: {
          reply_to: input.senderEmail,
          original_subject: input.subject,
          ai_summary: input.aiSummary,
          domain: "operative",
          category,
          previous_lead_status: currentLeadStatus,
          suggested_action: `Partner ri-coinvolto: era in "${currentLeadStatus}", ora ha inviato ${category}. Rispondere con Accompagnatore per coltivare il momentum.`,
        },
        status: "pending",
        priority: "high",
        reasoning: `Partner in "${currentLeadStatus}" ha inviato ${category} (confidence ${(input.confidence * 100).toFixed(0)}%). Segnale forte di ri-coinvolgimento → escalato a "engaged". Azione commerciale consigliata.`,
        created_at: now,
      });
      result.actionsExecuted.push("reengagement_commercial_action_created");
    } catch (e) {
      result.errors.push(`Re-engagement pending action failed: ${e}`);
    }
  }

  if (input.partnerId && currentLeadStatus === "converted") {
    try {
      const { data: insertedUpsellAction } = await supabase
        .from("ai_pending_actions")
        .insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          action_type: "upsell_opportunity",
          action_payload: {
            trigger_category: category,
            trigger_summary: input.aiSummary,
            sender_email: input.senderEmail,
            current_lead_status: "converted",
            suggested_action: "Riconoscere come opportunità di upsell/cross-sell. Cliente esistente mostra nuovo bisogno.",
          },
          status: "pending",
          priority: "high",
          reasoning: `Cliente convertito (stato "converted") ha inviato richiesta operativa (${category}). Opportunità di upsell/cross-sell.`,
          created_at: now,
        })
        .select("id")
        .single();

      if (insertedUpsellAction?.id) {
        result.actionsExecuted.push("operative_upsell_signal");
      }
    } catch (e) {
      result.errors.push(`Upsell opportunity action failed: ${e}`);
    }
  }

  if (needsReminder && input.partnerId) {
    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `Risposta a ${category} da ${input.senderName || input.senderEmail}`,
        description: input.aiSummary || `Operative request: ${category}. Response required.`,
        status: "pending",
        priority: "high",
        due_date: new Date(Date.now() + 86400000).toISOString(),
        source_meta: {
          domain: "operative",
          category,
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push("reminder_operative_T+1");
    } catch (e) {
      result.errors.push(`Operative reminder failed: ${e}`);
    }
  }
}

/**
 * ADMINISTRATIVE DOMAIN: invoice_query, payment_request, payment_confirmation,
 *                        credit_note, account_statement
 */
export async function handleAdministrativeRequest(
  supabase: SupabaseClient,
  input: DomainHandlerInput,
  result: PostClassificationResult,
) {
  const now = new Date().toISOString();
  const category = input.category as string;

  if (input.partnerId) {
    try {
      await supabase
        .from("partners")
        .update({ last_interaction_at: now })
        .eq("id", input.partnerId);
    } catch (e) {
      result.errors.push(`Failed to update partner interaction: ${e}`);
    }
  }

  if (category === "payment_confirmation") {
    result.actionsExecuted.push("admin_payment_confirmation_logged");
    return;
  }

  let actionType: string;
  let priority: "high" | "normal";
  let needsReminder = false;

  if (["invoice_query", "payment_request"].includes(category)) {
    actionType = "review_financial_request";
    priority = "high";
    needsReminder = true;
  } else if (["credit_note", "account_statement"].includes(category)) {
    actionType = "review_financial_document";
    priority = "normal";
  } else {
    actionType = "admin_action";
    priority = "normal";
  }

  try {
    const actionPayload = enrichActionPayload(
      {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        domain: "administrative",
        category,
        suggested_action: `Administrative request: ${category}. IMPORTANT: Requires manual review. Do not auto-generate responses for financial requests.`,
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
        priority,
        reasoning: `Administrative domain: ${category} (confidence ${(input.confidence * 100).toFixed(0)}%) - requires manual review`,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push(`admin_${actionType}`);
    }
  } catch (e) {
    result.errors.push(`Administrative pending action failed: ${e}`);
  }

  if (needsReminder && input.partnerId) {
    try {
      await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        source_id: input.partnerId,
        source_type: "partner",
        activity_type: "follow_up",
        title: `Revisione ${category} da ${input.senderName || input.senderEmail}`,
        description: input.aiSummary || `Administrative request: ${category}. Manual review required.`,
        status: "pending",
        priority: "high",
        due_date: new Date(Date.now() + 86400000).toISOString(),
        source_meta: {
          domain: "administrative",
          category,
          pipeline: "postClassification",
        },
      });
      result.reminderCreated = true;
      result.actionsExecuted.push("reminder_admin_T+1");
    } catch (e) {
      result.errors.push(`Administrative reminder failed: ${e}`);
    }
  }
}

/**
 * SUPPORT DOMAIN: complaint, service_inquiry, technical_issue, feedback
 */
export async function handleSupportRequest(
  supabase: SupabaseClient,
  input: DomainHandlerInput,
  result: PostClassificationResult,
  handleComplaintFn: (supabase: SupabaseClient, input: DomainHandlerInput, result: PostClassificationResult) => Promise<void>,
) {
  const now = new Date().toISOString();
  const category = input.category as string;

  if (category === "complaint") {
    await handleComplaintFn(supabase, input, result);
    return;
  }

  if (input.partnerId) {
    try {
      await supabase
        .from("partners")
        .update({ last_interaction_at: now })
        .eq("id", input.partnerId);
    } catch (e) {
      result.errors.push(`Failed to update partner interaction: ${e}`);
    }
  }

  if (category === "feedback") {
    const sentiment = input.sentiment || "neutral";
    if (sentiment === "negative") {
      try {
        await supabase.from("ai_pending_actions").insert({
          user_id: input.userId,
          partner_id: input.partnerId || null,
          action_type: "reply_to_support",
          action_payload: {
            reply_to: input.senderEmail,
            original_subject: input.subject,
            ai_summary: input.aiSummary,
            domain: "support",
            category: "negative_feedback",
            suggested_action: "Negative feedback received. Consider follow-up to understand and address concern.",
          },
          status: "pending",
          priority: "normal",
        });
        result.pendingActionCreated = true;
        result.actionsExecuted.push("support_negative_feedback_action");
      } catch (e) {
        result.errors.push(`Negative feedback action failed: ${e}`);
      }
    } else {
      result.actionsExecuted.push("support_positive_feedback_logged");
    }
    return;
  }

  let actionType: string;
  let priority: "high" | "normal" | "critical";

  if (["service_inquiry", "technical_issue"].includes(category)) {
    actionType = "reply_to_support";
    priority = (input.urgency ?? 1) >= 4 ? "critical" : (category === "technical_issue" ? "high" : "normal");
  } else {
    actionType = "support_action";
    priority = "normal";
  }

  try {
    const actionPayload = enrichActionPayload(
      {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        domain: "support",
        category,
        urgency: input.urgency,
        suggested_action: `Support request: ${category}. Provide helpful and prompt response.`,
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
        priority,
        reasoning: `Support domain: ${category} (confidence ${(input.confidence * 100).toFixed(0)}%, urgency ${input.urgency})`,
        created_at: now,
      })
      .select("id")
      .single();

    if (insertedAction?.id) {
      result.pendingActionCreated = true;
      result.actionsExecuted.push(`support_${actionType}`);
    }
  } catch (e) {
    result.errors.push(`Support pending action failed: ${e}`);
  }
}

/**
 * INTERNAL DOMAIN: newsletter, system_notification, internal_communication
 */
export async function handleInternalMessage(
  supabase: SupabaseClient,
  input: DomainHandlerInput,
  result: PostClassificationResult,
) {
  const category = input.category as string;

  if (["newsletter", "system_notification"].includes(category)) {
    result.actionsExecuted.push(`internal_${category}_auto_archived`);
    return;
  }

  if (category === "internal_communication") {
    result.actionsExecuted.push("internal_communication_logged");
    return;
  }

  result.actionsExecuted.push("internal_message_logged");
}
