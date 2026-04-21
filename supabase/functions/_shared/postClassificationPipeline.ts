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
 *
 * LOVABLE-93: Auto-draft generation per reply-type pending actions.
 * Quando viene creata una pending action di tipo reply_interested, reply_to_question,
 * handle_complaint, o send_graceful_close, viene generato automaticamente un draft
 * tramite aiChat e salvato nel campo action_payload con draft_subject e draft_body.
 */

import { applyLeadStatusChange } from "./leadStatusGuard.ts";
import { aiChat } from "./aiGateway.ts";

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
  | "uncategorized"
  // LOVABLE-93: Domain-specific categories
  | "quote_request"
  | "booking_request"
  | "rate_inquiry"
  | "shipment_tracking"
  | "cargo_status"
  | "documentation_request"
  | "invoice_query"
  | "payment_request"
  | "payment_confirmation"
  | "credit_note"
  | "account_statement"
  | "service_inquiry"
  | "technical_issue"
  | "feedback"
  | "newsletter"
  | "system_notification"
  | "internal_communication";

export type ClassificationDomain =
  | "commercial"
  | "operative"
  | "administrative"
  | "support"
  | "internal";

export interface EmailAddressRule {
  category?: string;
  custom_prompt?: string;
  tone_override?: string;
  topics_to_emphasize?: string[];
  topics_to_avoid?: string[];
}

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
  /** LOVABLE-93: Regole email address caricate per il sender */
  emailAddressRule?: EmailAddressRule;
  /** LOVABLE-93: Domain classification (commercial/operative/administrative/support/internal) */
  domain?: ClassificationDomain;
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
    // LOVABLE-93: Carica email_address_rules per il sender
    const { data: addressRule } = await supabase
      .from("email_address_rules")
      .select("category, custom_prompt, tone_override, topics_to_emphasize, topics_to_avoid")
      .eq("email_address", input.senderEmail)
      .eq("user_id", input.userId)
      .maybeSingle();

    // Arricchisci input con email_address_rules context se disponibile
    const enrichedInput = {
      ...input,
      emailAddressRule: addressRule || undefined,
    };

    // LOVABLE-93: handler per dominio (operative/admin/support/internal)
    // Check domain BEFORE category routing
    const domain = enrichedInput.domain || "commercial";
    if (domain !== "commercial") {
      // Route to domain-specific handlers
      switch (domain) {
        case "operative":
          await handleOperativeRequest(supabase, enrichedInput, result);
          break;
        case "administrative":
          await handleAdministrativeRequest(supabase, enrichedInput, result);
          break;
        case "support":
          await handleSupportRequest(supabase, enrichedInput, result);
          break;
        case "internal":
          await handleInternalMessage(supabase, enrichedInput, result);
          break;
      }
    } else {
      // Commercial domain: route by category as usual
      switch (input.category) {
        case "interested":
        case "meeting_request":
          await handleInterested(supabase, enrichedInput, result);
          break;

        case "not_interested":
          await handleNotInterested(supabase, enrichedInput, result);
          break;

        case "auto_reply":
          await handleOutOfOffice(supabase, enrichedInput, result);
          break;

        case "bounce":
          await handleBounce(supabase, enrichedInput, result);
          break;

        case "unsubscribe":
          await handleUnsubscribe(supabase, enrichedInput, result);
          break;

        case "question":
        case "request_info":
          await handleQuestion(supabase, enrichedInput, result);
          break;

        case "complaint":
          await handleComplaint(supabase, enrichedInput, result);
          break;

        case "follow_up":
          // Follow-up dal partner = segnale positivo, tratta come interested leggero
          await handleFollowUp(supabase, enrichedInput, result);
          break;

        case "spam":
        case "uncategorized":
          // Nessuna azione automatica, solo log
          result.actionsExecuted.push("skip_no_action");
          break;
      }
    }
  } catch (e) {
    result.errors.push(`Pipeline error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Helper: LOVABLE-93 Auto-draft generation per reply-type pending actions
// ═══════════════════════════════════════════════════════════════════

/**
 * Genera un draft di risposta utilizzando aiChat.
 * Fire-and-forget: eventuali errori non bloccano il flusso principale.
 */
async function generateReplyDraft(
  supabase: SupabaseClient,
  pendingActionId: string,
  input: ClassificationInput,
  category: "reply_interested" | "reply_to_question" | "handle_complaint" | "send_graceful_close",
): Promise<void> {
  try {
    // Costruisci il prompt contextuale basato sulla categoria e sul contesto disponibile
    let tone = "professional";
    let categoryHint = "";

    switch (category) {
      case "reply_interested":
        tone = "warm";
        categoryHint = "Il partner ha mostrato interesse. La risposta deve essere positiva, concreta e proporre i prossimi step.";
        break;
      case "reply_to_question":
        tone = "helpful";
        categoryHint = "Il partner ha posto una domanda. La risposta deve essere chiara, utile e basata su KB/expertise disponibile.";
        break;
      case "handle_complaint":
        tone = "empathetic";
        categoryHint = "È stato ricevuto un reclamo. La risposta deve essere empatica, riconoscere il problema e proporre una soluzione concreta.";
        break;
      case "send_graceful_close":
        tone = "graceful";
        categoryHint = "Il partner non è interessato. La risposta deve chiudere con eleganza, ringraziare e lasciare la porta aperta senza pressione.";
        break;
    }

    // Assembla i topic hints dall'email_address_rule
    const topicsStr = (input.emailAddressRule?.topics_to_emphasize || []).join(", ");

    const systemPrompt = `Tu sei un assistente AI per la composizione di email professionali.
Tono richiesto: ${tone}
Contesto: ${categoryHint}
${input.emailAddressRule?.custom_prompt ? `Istruzioni personalizzate: ${input.emailAddressRule.custom_prompt}` : ""}
${topicsStr ? `Topic da enfatizzare: ${topicsStr}` : ""}`;

    const userPrompt = `Genera un draft di risposta email basato su:
- Riassunto dell'email originale: ${input.aiSummary || "N/A"}
- Oggetto originale: ${input.subject || "N/A"}
- Email mittente: ${input.senderEmail}

Restituisci il draft in questo formato JSON:
{
  "draft_subject": "Oggetto della risposta",
  "draft_body": "Corpo della risposta (markdown semplice, max 300 parole)"
}`;

    const result = await aiChat({
      models: ["google/gemini-2.5-flash"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      context: `draft_generation_${category}`,
    });

    if (result.content) {
      // Parse JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const draft = JSON.parse(jsonMatch[0]);
        if (draft.draft_subject && draft.draft_body) {
          // Update pending action with draft
          await supabase
            .from("ai_pending_actions")
            .update({
              action_payload: (action_payload) => ({
                ...action_payload,
                draft_subject: draft.draft_subject,
                draft_body: draft.draft_body,
                draft_generated_at: new Date().toISOString(),
              }),
            })
            .eq("id", pendingActionId);
        }
      }
    }
  } catch (e) {
    // LOVABLE-93: Errori nella generazione del draft non bloccano il flusso principale
    // (draft generation è fire-and-forget)
    console.warn(`[LOVABLE-93] Draft generation failed for ${category}: ${e}`);
  }
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
  // LOVABLE-93: Includi email_address_rules context nel payload per draft generation
  const actionType =
    input.category === "meeting_request" ? "schedule_meeting" : "reply_interested";
  let pendingActionId: string | null = null;
  try {
    const actionPayload: Record<string, unknown> = {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      suggested_action:
        input.category === "meeting_request"
          ? "Proponi disponibilità per call/meeting"
          : "Rispondi con prossimo passo concreto (Accompagnatore)",
    };

    // LOVABLE-93: Aggiungi tone/topics/custom_prompt dal email_address_rule
    if (input.emailAddressRule) {
      if (input.emailAddressRule.tone_override) {
        actionPayload.tone_override = input.emailAddressRule.tone_override;
      }
      if (input.emailAddressRule.custom_prompt) {
        actionPayload.custom_prompt = input.emailAddressRule.custom_prompt;
      }
      if (input.emailAddressRule.topics_to_emphasize?.length) {
        actionPayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
      }
      if (input.emailAddressRule.topics_to_avoid?.length) {
        actionPayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
      }
    }

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

      // LOVABLE-93: Genera draft automaticamente se è una reply_interested (non per schedule_meeting)
      if (actionType === "reply_interested") {
        generateReplyDraft(supabase, pendingActionId, input, "reply_interested").catch((e) => {
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
  // LOVABLE-93: Includi email_address_rules context nel payload
  const gracefulClosePayload: Record<string, unknown> = {
    reply_to: input.senderEmail,
    original_subject: input.subject,
    ai_summary: input.aiSummary,
    suggested_action:
      "Invia chiusura elegante (Chiusore): ringrazia, lascia porta aperta, nessuna pressione",
  };

  // LOVABLE-93: Aggiungi tone/topics/custom_prompt dal email_address_rule
  if (input.emailAddressRule) {
    if (input.emailAddressRule.tone_override) {
      gracefulClosePayload.tone_override = input.emailAddressRule.tone_override;
    }
    if (input.emailAddressRule.custom_prompt) {
      gracefulClosePayload.custom_prompt = input.emailAddressRule.custom_prompt;
    }
    if (input.emailAddressRule.topics_to_emphasize?.length) {
      gracefulClosePayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
    }
    if (input.emailAddressRule.topics_to_avoid?.length) {
      gracefulClosePayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
    }
  }

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

      // LOVABLE-93: Genera draft automaticamente per chiusura elegante
      generateReplyDraft(supabase, insertedAction.id, input, "send_graceful_close").catch((e) => {
        console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
      });
    }
  } catch (e) {
    result.errors.push(`Graceful close pending action failed: ${e}`);
  }
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
  // LOVABLE-93: Includi email_address_rules context nel payload
  try {
    const actionPayload: Record<string, unknown> = {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      urgency: input.urgency,
      suggested_action: isUrgent
        ? "Domanda urgente — risposta richiesta entro 24h"
        : "Domanda dal partner — prepara risposta appoggiandoti a KB",
    };

    // LOVABLE-93: Aggiungi tone/topics/custom_prompt dal email_address_rule
    if (input.emailAddressRule) {
      if (input.emailAddressRule.tone_override) {
        actionPayload.tone_override = input.emailAddressRule.tone_override;
      }
      if (input.emailAddressRule.custom_prompt) {
        actionPayload.custom_prompt = input.emailAddressRule.custom_prompt;
      }
      if (input.emailAddressRule.topics_to_emphasize?.length) {
        actionPayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
      }
      if (input.emailAddressRule.topics_to_avoid?.length) {
        actionPayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
      }
    }

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

      // LOVABLE-93: Genera draft automaticamente per risposta a domanda
      generateReplyDraft(supabase, insertedAction.id, input, "reply_to_question").catch((e) => {
        console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
      });
    }
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
  // LOVABLE-93: Includi email_address_rules context nel payload per risposta personalizzata
  try {
    const actionPayload: Record<string, unknown> = {
      sender: input.senderEmail,
      subject: input.subject,
      ai_summary: input.aiSummary,
      urgency: 5,
      suggested_action:
        "RECLAMO RICEVUTO — richiede attenzione immediata. Risposta entro 24h. Tono: empatico, risolutivo, MAI difensivo.",
    };

    // LOVABLE-93: Aggiungi tone/topics/custom_prompt dal email_address_rule
    if (input.emailAddressRule) {
      if (input.emailAddressRule.tone_override) {
        actionPayload.tone_override = input.emailAddressRule.tone_override;
      }
      if (input.emailAddressRule.custom_prompt) {
        actionPayload.custom_prompt = input.emailAddressRule.custom_prompt;
      }
      if (input.emailAddressRule.topics_to_emphasize?.length) {
        actionPayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
      }
      if (input.emailAddressRule.topics_to_avoid?.length) {
        actionPayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
      }
    }

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

      // LOVABLE-93: Genera draft automaticamente per risposta a reclamo (empathetic tone)
      generateReplyDraft(supabase, insertedAction.id, input, "handle_complaint").catch((e) => {
        console.warn(`[LOVABLE-93] Draft generation failed: ${e}`);
      });
    }
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

// ═══════════════════════════════════════════════════════════════════
// LOVABLE-93: DOMAIN-SPECIFIC HANDLERS
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// OPERATIVE DOMAIN: quote_request, booking_request, rate_inquiry,
//                   shipment_tracking, cargo_status, documentation_request
// ═══════════════════════════════════════════════════════════════════
async function handleOperativeRequest(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  const now = new Date().toISOString();
  const category = input.category as string;

  // Update last_interaction_at su partner
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

  // Route by operative category
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
    // Unknown operative category, default to generic operative action
    actionType = "operative_action";
    priority = "normal";
  }

  // LOVABLE-93: Check for conversion signal: if lead_status is "negotiation" or "qualified"
  // and category is quote_request/booking_request/rate_inquiry
  let isConversionSignal = false;
  let currentLeadStatus: string | null = null;
  if (input.partnerId && ["quote_request", "booking_request", "rate_inquiry"].includes(category)) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", input.partnerId)
        .maybeSingle();

      currentLeadStatus = partner?.lead_status || null;
      // LOVABLE-93: Conversion signal when negotiation OR qualified stage receives operative request
      if (["negotiation", "qualified"].includes(currentLeadStatus || "")) {
        isConversionSignal = true;
      }
    } catch (e) {
      result.errors.push(`Failed to check conversion signal: ${e}`);
    }
  }

  // LOVABLE-93: Soft signal for engaged → suggest qualification
  let isSoftSignalQualification = false;
  if (input.partnerId && ["quote_request", "booking_request", "rate_inquiry"].includes(category)) {
    if (currentLeadStatus === "engaged") {
      isSoftSignalQualification = true;
    }
  }

  // Create main pending action
  try {
    const actionPayload: Record<string, unknown> = {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      domain: "operative",
      category,
      suggested_action: `Operative request: ${category}`,
    };

    // Add email_address_rules context if available
    if (input.emailAddressRule) {
      if (input.emailAddressRule.tone_override) {
        actionPayload.tone_override = input.emailAddressRule.tone_override;
      }
      if (input.emailAddressRule.custom_prompt) {
        actionPayload.custom_prompt = input.emailAddressRule.custom_prompt;
      }
      if (input.emailAddressRule.topics_to_emphasize?.length) {
        actionPayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
      }
      if (input.emailAddressRule.topics_to_avoid?.length) {
        actionPayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
      }
    }

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

  // LOVABLE-93: Create conversion signal action if needed
  // Trigger: Partner in "negotiation" or "qualified" sends operative request
  // Action: Create pending "confirm_conversion" (NOT auto-executed — requires user confirmation)
  if (isConversionSignal && currentLeadStatus) {
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
        console.log(
          `[LOVABLE-93] Conversion signal detected: partner=${input.partnerId} ` +
          `status=${currentLeadStatus} category=${category}`
        );
      }
    } catch (e) {
      result.errors.push(`Conversion signal action failed: ${e}`);
    }
  }

  // LOVABLE-93: Create soft signal action for engaged → suggest qualification
  // If engaged partner sends operative request, suggest qualification
  if (isSoftSignalQualification) {
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
      console.log(
        `[LOVABLE-93] Qualification signal: partner=${input.partnerId} ` +
        `category=${category}`
      );
    } catch (e) {
      result.errors.push(`Qualification suggestion failed: ${e}`);
    }
  }

  // LOVABLE-93: Check for UPSELL signal (reverse case)
  // If partner is "converted" (already a client) and receives operative request,
  // this is UPSELL, not re-entry into prospect funnel
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
        console.log(
          `[LOVABLE-93] Upsell opportunity detected: partner=${input.partnerId} ` +
          `category=${category}`
        );
      }
    } catch (e) {
      result.errors.push(`Upsell opportunity action failed: ${e}`);
    }
  }

  // Create T+1 reminder if needed
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

// ═══════════════════════════════════════════════════════════════════
// ADMINISTRATIVE DOMAIN: invoice_query, payment_request, payment_confirmation,
//                        credit_note, account_statement
// ═══════════════════════════════════════════════════════════════════
async function handleAdministrativeRequest(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  const now = new Date().toISOString();
  const category = input.category as string;

  // Update last_interaction_at su partner
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

  // Handle payment_confirmation: just log, no action
  if (category === "payment_confirmation") {
    result.actionsExecuted.push("admin_payment_confirmation_logged");
    return;
  }

  // Route by administrative category
  let actionType: string;
  let priority: "high" | "normal";
  let needsReminder = false;

  if (["invoice_query", "payment_request"].includes(category)) {
    actionType = "review_financial_request";
    priority = "high";
    needsReminder = true;
    // NOTE: DO NOT auto-generate responses for financial requests (risky)
  } else if (["credit_note", "account_statement"].includes(category)) {
    actionType = "review_financial_document";
    priority = "normal";
  } else {
    actionType = "admin_action";
    priority = "normal";
  }

  // Create pending action (NO auto-draft for financial = risky)
  try {
    const actionPayload: Record<string, unknown> = {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      domain: "administrative",
      category,
      suggested_action: `Administrative request: ${category}. IMPORTANT: Requires manual review. Do not auto-generate responses for financial requests.`,
    };

    // Add email_address_rules context if available
    if (input.emailAddressRule) {
      if (input.emailAddressRule.tone_override) {
        actionPayload.tone_override = input.emailAddressRule.tone_override;
      }
      if (input.emailAddressRule.custom_prompt) {
        actionPayload.custom_prompt = input.emailAddressRule.custom_prompt;
      }
      if (input.emailAddressRule.topics_to_emphasize?.length) {
        actionPayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
      }
      if (input.emailAddressRule.topics_to_avoid?.length) {
        actionPayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
      }
    }

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

  // Create T+1 reminder if needed (for high-priority financial requests)
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

// ═══════════════════════════════════════════════════════════════════
// SUPPORT DOMAIN: complaint, service_inquiry, technical_issue, feedback
// ═══════════════════════════════════════════════════════════════════
async function handleSupportRequest(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  const now = new Date().toISOString();
  const category = input.category as string;

  // Handle complaint: use existing handleComplaint logic
  if (category === "complaint") {
    await handleComplaint(supabase, input, result);
    return;
  }

  // Update last_interaction_at su partner
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

  // Handle feedback: only create action if negative
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
      // Positive feedback: just log
      result.actionsExecuted.push("support_positive_feedback_logged");
    }
    return;
  }

  // Route by support category
  let actionType: string;
  let priority: "high" | "normal" | "critical";

  if (["service_inquiry", "technical_issue"].includes(category)) {
    actionType = "reply_to_support";
    // Determine priority based on urgency
    priority = (input.urgency ?? 1) >= 4 ? "critical" : (category === "technical_issue" ? "high" : "normal");
  } else {
    actionType = "support_action";
    priority = "normal";
  }

  // Create pending action for support requests
  try {
    const actionPayload: Record<string, unknown> = {
      reply_to: input.senderEmail,
      original_subject: input.subject,
      ai_summary: input.aiSummary,
      domain: "support",
      category,
      urgency: input.urgency,
      suggested_action: `Support request: ${category}. Provide helpful and prompt response.`,
    };

    // Add email_address_rules context if available
    if (input.emailAddressRule) {
      if (input.emailAddressRule.tone_override) {
        actionPayload.tone_override = input.emailAddressRule.tone_override;
      }
      if (input.emailAddressRule.custom_prompt) {
        actionPayload.custom_prompt = input.emailAddressRule.custom_prompt;
      }
      if (input.emailAddressRule.topics_to_emphasize?.length) {
        actionPayload.topics_to_emphasize = input.emailAddressRule.topics_to_emphasize;
      }
      if (input.emailAddressRule.topics_to_avoid?.length) {
        actionPayload.topics_to_avoid = input.emailAddressRule.topics_to_avoid;
      }
    }

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

// ═══════════════════════════════════════════════════════════════════
// INTERNAL DOMAIN: newsletter, system_notification, internal_communication
// ═══════════════════════════════════════════════════════════════════
async function handleInternalMessage(
  supabase: SupabaseClient,
  input: ClassificationInput,
  result: PostClassificationResult,
) {
  const category = input.category as string;

  // Handle newsletter and system_notification: auto-archive
  if (["newsletter", "system_notification"].includes(category)) {
    // Auto-archive: no user action needed, just log
    result.actionsExecuted.push(`internal_${category}_auto_archived`);
    return;
  }

  // Handle internal_communication: just log, no action
  if (category === "internal_communication") {
    result.actionsExecuted.push("internal_communication_logged");
    return;
  }

  // Unknown internal category, log it
  result.actionsExecuted.push("internal_message_logged");
}
