/**
 * postClassificationPipeline.ts — Catena azioni post-classificazione (LOVABLE-86).
 *
 * Dopo che classify-email-response classifica un'email inbound,
 * questa pipeline decide e esegue le azioni appropriate per ciascun caso:
 *
 *   1. INTERESTED → escalate status, crea reminder, prepara draft risposta
 *   2. NOT_INTERESTED → archiviazione elegante, offri uscita dignitosa
 *   3. OUT_OF_OFFICE → crea reminder post-OOO, congela sequenza
 *   4. BOUNCE → marca email invalida, suggerisci canale alternativo
 *   5. UNSUBSCRIBE → blacklist email, rimuovi da coda, log audit
 *
 * Aggiuntivi:
 *   6. QUESTION → crea pending action per risposta, escalation se urgente
 *   7. MEETING_REQUEST → crea pending action per scheduling
 *   8. COMPLAINT → escalation immediata, alta priorità
 */

import { applyLeadStatusChange } from "./leadStatusGuard.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type ClassificationCategory =
  | "interested"
  | "not_interested"
  | "request_info"
  | "question"
  | "meeting_request"
  | "complaint"
  | "follow_up"
  | "auto_reply"
  | "unsubscribe"
  | "bounce"
  | "spam"
  | "uncategorized";

export interface ClassificationInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  category: ClassificationCategory;
  confidence: number;
  senderEmail: string;
  senderName?: string;
  subject?: string;
  /** Riassunto AI del contenuto */
  aiSummary?: string;
  /** Urgenza rilevata (1-5) */
  urgency?: number;
  /** Sentiment (positive/negative/neutral) */
  sentiment?: string;
  /** Canale originale */
  channel?: "email" | "whatsapp" | "linkedin";
  /** Data OOO rilevata (per auto_reply) */
  oooReturnDate?: string;
}

export interface PostClassificationResult {
  actionsExecuted: string[];
  statusChanged: boolean;
  pendingActionCreated: boolean;
  reminderCreated: boolean;
  errors: string[];
}

/**
 * Pipeline principale. Chiamare DOPO la classificazione.
 */
export async function runPostClassificationPipeline(
  supabase: SupabaseClient,
  input: ClassificationInput,
): Promise<PostClassificationResult> {
  const result: PostClassificationResult = {
    actionsExecuted: [],
    statusChanged: false,
    pendingActionCreated: false,
    reminderCreated: false,
    errors: [],
  };

  try {
    switch (input.category) {
      case "interested":
      case "meeting_request":
        await handleInterested(supabase, input, result);
        break;

      case "not_interested":
        await handleNotInterested(supabase, input, result);
        break;

      case "auto_reply":
        await handleOutOfOffice(supabase, input, result);
        break;

      case "bounce":
        await handleBounce(supabase, input, result);
        break;

      case "unsubscribe":
        await handleUnsubscribe(supabase, input, result);
        break;

      case "question":
      case "request_info":
        await handleQuestion(supabase, input, result);
        break;

      case "complaint":
        await handleComplaint(supabase, input, result);
        break;

      case "follow_up":
        // Follow-up dal partner = segnale positivo, tratta come interested leggero
        await handleFollowUp(supabase, input, result);
        break;

      case "spam":
      case "uncategorized":
        // Nessuna azione automatica, solo log
        result.actionsExecuted.push("skip_no_action");
        break;
    }
  } catch (e) {
    result.errors.push(`Pipeline error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 1. INTERESTED / MEETING_REQUEST
// ═══════════════════════════════════════════════════════════════════
async function handleInterested(
  supabase: SupabaseClient,
  input: ClassificationInput,
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
  try {
    await supabase.from("ai_pending_actions").insert({
      user_id: input.userId,
      partner_id: input.partnerId || null,
      action_type: actionType,
      action_payload: {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        suggested_action:
          input.category === "meeting_request"
            ? "Proponi disponibilità per call/meeting"
            : "Rispondi con prossimo passo concreto (Accompagnatore)",
      },
      status: "pending",
      priority: input.category === "meeting_request" ? "high" : "normal",
      reasoning: `Classificazione automatica: ${input.category} (${(input.confidence * 100).toFixed(0)}%)`,
      created_at: now,
    });
    result.pendingActionCreated = true;
    result.actionsExecuted.push(`pending_action_${actionType}`);
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

// ═══════════════════════════════════════════════════════════════════
// 2. NOT_INTERESTED
// ═══════════════════════════════════════════════════════════════════
async function handleNotInterested(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  // Solo con alta confidence (≥80%)
  if (input.confidence < 0.8) {
    // Bassa confidence: crea pending action per review umano
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

  // Alta confidence: archiviazione elegante
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

    // Cancella reminder pending per questo partner
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

  // Crea pending action per eventuale messaggio di chiusura elegante
  await supabase.from("ai_pending_actions").insert({
    user_id: input.userId,
    partner_id: input.partnerId || null,
    action_type: "send_graceful_close",
    action_payload: {
      reply_to: input.senderEmail,
      suggested_action:
        "Invia chiusura elegante (Chiusore): ringrazia, lascia porta aperta, nessuna pressione",
    },
    status: "pending",
    priority: "low",
  });
  result.pendingActionCreated = true;
  result.actionsExecuted.push("pending_graceful_close");
}

// ═══════════════════════════════════════════════════════════════════
// 3. OUT OF OFFICE / AUTO-REPLY
// ═══════════════════════════════════════════════════════════════════
async function handleOutOfOffice(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  // Calcola data ritorno
  let returnDate: Date;
  if (input.oooReturnDate) {
    returnDate = new Date(input.oooReturnDate);
    if (isNaN(returnDate.getTime())) {
      returnDate = new Date(Date.now() + 7 * 86400000); // default 7gg
    }
  } else {
    returnDate = new Date(Date.now() + 7 * 86400000); // default 7gg
  }

  // Aggiungi 1 giorno dopo il ritorno per il follow-up
  const followUpDate = new Date(returnDate.getTime() + 86400000);

  // a) Congela sequenza: cancella reminder pending e ricrea dopo ritorno
  if (input.partnerId) {
    try {
      // Cancella reminder in attesa
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

    // b) Crea reminder post-OOO
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

// ═══════════════════════════════════════════════════════════════════
// 4. BOUNCE
// ═══════════════════════════════════════════════════════════════════
async function handleBounce(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  // a) Marca email come bounced su imported_contacts e partners
  const email = input.senderEmail.toLowerCase().trim();
  try {
    await supabase
      .from("imported_contacts")
      .update({ email_status: "bounced" })
      .ilike("email", email);
    await supabase
      .from("partners")
      .update({ email_status: "bounced" })
      .ilike("email", email);
    result.actionsExecuted.push("email_marked_bounced");
  } catch (e) {
    result.errors.push(`Bounce mark failed: ${e}`);
  }

  // b) Crea regola auto-archive per questa email
  try {
    await supabase.from("email_address_rules").upsert(
      {
        user_id: input.userId,
        email_address: email,
        auto_action: "archive",
        reason: "hard_bounce_detected",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_address" },
    );
    result.actionsExecuted.push("archive_rule_created");
  } catch {
    // Tabella potrebbe non esistere, ignora
  }

  // c) Se c'è un partner, suggerisci canale alternativo
  if (input.partnerId) {
    try {
      await supabase.from("ai_pending_actions").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        action_type: "suggest_alternative_channel",
        action_payload: {
          bounced_email: email,
          suggested_action:
            "Email bounce rilevato. Prova canale alternativo: LinkedIn o telefono dal profilo WCA.",
        },
        status: "pending",
        priority: "normal",
      });
      result.pendingActionCreated = true;
      result.actionsExecuted.push("suggest_alternative_channel");
    } catch (e) {
      result.errors.push(`Alt channel suggestion failed: ${e}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. UNSUBSCRIBE
// ═══════════════════════════════════════════════════════════════════
async function handleUnsubscribe(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  const email = input.senderEmail.toLowerCase().trim();

  // a) Blacklist il partner
  if (input.partnerId) {
    try {
      const res = await applyLeadStatusChange(supabase, {
        table: "partners",
        recordId: input.partnerId,
        newStatus: "blacklisted",
        userId: input.userId,
        actor: { type: "system", name: "postClassificationPipeline" },
        decisionOrigin: "system_trigger",
        trigger: "Richiesta unsubscribe esplicita",
        metadata: { category: "unsubscribe", sender: email },
      });
      if (res.applied) {
        result.statusChanged = true;
        result.actionsExecuted.push("status_to_blacklisted");
      }
    } catch (e) {
      result.errors.push(`Blacklist failed: ${e}`);
    }
  }

  // b) Aggiungi a blacklist table
  try {
    await supabase.from("blacklist").upsert(
      {
        user_id: input.userId,
        email,
        reason: "Unsubscribe request",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email" },
    );
    result.actionsExecuted.push("added_to_blacklist");
  } catch {
    // Potrebbe non avere unique constraint, prova insert
    try {
      await supabase.from("blacklist").insert({
        user_id: input.userId,
        email,
        reason: "Unsubscribe request",
      });
      result.actionsExecuted.push("added_to_blacklist");
    } catch {
      // Ignora duplicati
    }
  }

  // c) Rimuovi dalla coda email se presente
  try {
    await supabase
      .from("email_campaign_queue")
      .update({ status: "cancelled" })
      .eq("user_id", input.userId)
      .eq("recipient_email", email)
      .eq("status", "pending");
    result.actionsExecuted.push("removed_from_queue");
  } catch {
    // Non critico
  }

  // d) Cancella tutti i reminder pending
  if (input.partnerId) {
    try {
      await supabase
        .from("activities")
        .update({ status: "cancelled" })
        .eq("partner_id", input.partnerId)
        .eq("user_id", input.userId)
        .eq("status", "pending");
      result.actionsExecuted.push("cancelled_all_reminders");
    } catch {
      // Non critico
    }
  }

  // e) Crea regola hide per questa email
  try {
    await supabase.from("email_address_rules").upsert(
      {
        user_id: input.userId,
        email_address: email,
        auto_action: "hide",
        reason: "unsubscribe_request",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_address" },
    );
    result.actionsExecuted.push("hide_rule_created");
  } catch {
    // Ignora
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. QUESTION / REQUEST_INFO
// ═══════════════════════════════════════════════════════════════════
async function handleQuestion(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  const isUrgent = (input.urgency ?? 1) >= 4;
  const priority = isUrgent ? "critical" : "high";

  // Crea pending action per risposta
  try {
    await supabase.from("ai_pending_actions").insert({
      user_id: input.userId,
      partner_id: input.partnerId || null,
      action_type: "reply_to_question",
      action_payload: {
        reply_to: input.senderEmail,
        original_subject: input.subject,
        ai_summary: input.aiSummary,
        urgency: input.urgency,
        suggested_action: isUrgent
          ? "Domanda urgente — risposta richiesta entro 24h"
          : "Domanda dal partner — prepara risposta appoggiandoti a KB",
      },
      status: "pending",
      priority,
    });
    result.pendingActionCreated = true;
    result.actionsExecuted.push(`pending_reply_question_${priority}`);
  } catch (e) {
    result.errors.push(`Question action failed: ${e}`);
  }

  // Crea reminder
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

// ═══════════════════════════════════════════════════════════════════
// 7. COMPLAINT
// ═══════════════════════════════════════════════════════════════════
async function handleComplaint(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  // Escalation immediata: pending action critica
  try {
    await supabase.from("ai_pending_actions").insert({
      user_id: input.userId,
      partner_id: input.partnerId || null,
      action_type: "handle_complaint",
      action_payload: {
        sender: input.senderEmail,
        subject: input.subject,
        ai_summary: input.aiSummary,
        urgency: 5,
        suggested_action:
          "RECLAMO RICEVUTO — richiede attenzione immediata. Risposta entro 24h. Tono: empatico, risolutivo, MAI difensivo.",
      },
      status: "pending",
      priority: "critical",
    });
    result.pendingActionCreated = true;
    result.actionsExecuted.push("pending_complaint_critical");
  } catch (e) {
    result.errors.push(`Complaint action failed: ${e}`);
  }

  // Reminder urgente
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
        due_date: new Date(Date.now() + 86400000).toISOString(), // T+1
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

// ═══════════════════════════════════════════════════════════════════
// 8. FOLLOW_UP (dal partner)
// ═══════════════════════════════════════════════════════════════════
async function handleFollowUp(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  // Follow-up dal partner = segnale positivo leggero → aggiorna timestamp
  if (input.partnerId) {
    await supabase
      .from("partners")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", input.partnerId);
  }

  // Crea reminder per risposta (T+2)
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
