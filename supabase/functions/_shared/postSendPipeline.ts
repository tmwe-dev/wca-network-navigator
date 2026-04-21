/**
 * postSendPipeline.ts — Pipeline unificata post-invio (LOVABLE-85 + LOVABLE-93).
 *
 * TUTTI i punti di invio (send-email, process-email-queue, agent-execute,
 * cadence-engine, pending-action-executor, log-action edge) DEVONO passare
 * per questa pipeline. Supporta TUTTI i canali e TUTTI i source_type.
 *
 * Esegue in ordine:
 *   a. Log activity (tipo, canale, partner/contact/business_card, timestamp)
 *   b. Update lead_status (new→first_touch_sent, o nessun cambio se già avanzato)
 *      — Supporta: partners, imported_contacts, business_cards
 *   c. Crea interaction / contact_interaction in base al source_type
 *   d. Crea reminder follow-up con timing per canale (solo partner)
 *   e. Calcola next_action dalla sequenza
 *   f. Incrementa touch_count sul partner
 *   g. Scrive supervisor_audit_log per OGNI invio (LOVABLE-93)
 *
 * Idempotenza: check su (partner_id, channel, created_at within 60s) per evitare duplicati.
 */

import { applyLeadStatusChange } from "./leadStatusGuard.ts";
import { logSupervisorAudit } from "./supervisorAudit.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type SendChannel = "email" | "whatsapp" | "linkedin" | "sms";
export type SourceType = "partner" | "imported_contact" | "business_card";

export interface PostSendPipelineInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  /** LOVABLE-93: source_type esplicito. Default: "partner" (retrocompatibilità) */
  sourceType?: SourceType;
  /** ID della sorgente (partner_id, contact_id, o business_card_id). Se assente usa partnerId || contactId */
  sourceId?: string | null;
  /** ID business_card (solo se sourceType = "business_card") */
  businessCardId?: string | null;
  channel: SendChannel;
  /** Subject per email, preview per WA/LinkedIn */
  subject?: string;
  /** Corpo messaggio (HTML per email, testo per altri) */
  body?: string;
  /** Destinatario */
  to: string;
  /** Giorno della sequenza (0, 3, 7, 8, 12, 16, 23) */
  sequenceDay?: number;
  /** ID agente se eseguito da AI agent */
  agentId?: string;
  /** Source caller per audit trail */
  source: "email_forge" | "agent" | "cadence" | "batch" | "pending_action" | "manual";
  /** Metadata aggiuntivi */
  meta?: Record<string, unknown>;
  /** Message ID esterno (SMTP, wamid, etc.) */
  messageIdExternal?: string;
  /** Thread ID per raggruppamento */
  threadId?: string;
  /** LOVABLE-93: decision_origin per supervisor audit */
  decisionOrigin?: "manual" | "ai_auto" | "ai_approved" | "system_trigger";
  /** LOVABLE-93: actor_type per supervisor audit */
  actorType?: "user" | "ai_agent" | "system" | "cron";
}

export interface PostSendPipelineResult {
  activityLogged: boolean;
  statusUpdated: boolean;
  reminderCreated: boolean;
  nextActionEnsured: boolean;
  touchCountIncremented: boolean;
  /** LOVABLE-93: supervisor audit logged */
  auditLogged: boolean;
  /** LOVABLE-93: contact interaction logged (imported_contact) */
  contactInteractionLogged: boolean;
  /** True se la pipeline ha rilevato un duplicato e ha saltato l'esecuzione */
  skippedAsDuplicate: boolean;
}

/**
 * Sequenza canonica primo contatto (Costituzione §3).
 */
const SEQUENCE_NEXT: Record<
  number,
  { nextDay: number; channel: "email" | "linkedin" } | null
> = {
  0: { nextDay: 3, channel: "linkedin" },
  3: { nextDay: 7, channel: "linkedin" },
  7: { nextDay: 8, channel: "email" },
  8: { nextDay: 12, channel: "linkedin" },
  12: { nextDay: 16, channel: "email" },
  16: { nextDay: 23, channel: "email" },
  23: null,
};

/**
 * Timing follow-up per canale e stato.
 */
function getFollowUpDays(
  channel: SendChannel,
  leadStatus: string,
  isFirstContact: boolean,
): number {
  if (channel === "email") {
    if (isFirstContact) return 3;
    if (leadStatus === "negotiation") return 2;
    return 5;
  }
  if (channel === "whatsapp") {
    if (leadStatus === "negotiation") return 2;
    return 5;
  }
  // LinkedIn: tempi più lunghi
  return 7;
}

/**
 * Pipeline unificata. Chiamarla per OGNI invio riuscito.
 */
export async function runPostSendPipeline(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
): Promise<PostSendPipelineResult> {
  const result: PostSendPipelineResult = {
    activityLogged: false,
    statusUpdated: false,
    reminderCreated: false,
    nextActionEnsured: false,
    touchCountIncremented: false,
    auditLogged: false,
    contactInteractionLogged: false,
    skippedAsDuplicate: false,
  };

  const now = new Date().toISOString();

  // LOVABLE-93: Resolve source type (retrocompatibile: default = partner se partnerId presente)
  const resolvedSourceType: SourceType = input.sourceType
    || (input.partnerId ? "partner" : input.contactId ? "imported_contact" : "partner");
  const resolvedSourceId = input.sourceId
    || input.partnerId || input.contactId || input.businessCardId || crypto.randomUUID();

  // === IDEMPOTENCY CHECK ===
  if (input.partnerId) {
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    const activityType = channelToActivityType(input.channel);
    const { count } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .eq("partner_id", input.partnerId)
      .eq("activity_type", activityType)
      .gte("created_at", sixtySecondsAgo);

    if ((count ?? 0) > 0) {
      console.log(
        `[postSendPipeline] Duplicato rilevato: ${input.channel} a partner ${input.partnerId} negli ultimi 60s. Skip.`,
      );
      result.skippedAsDuplicate = true;
      return result;
    }
  }

  // === a. LOG ACTIVITY ===
  try {
    const activityType = channelToActivityType(input.channel);
    const { error } = await supabase.from("activities").insert({
      user_id: input.userId,
      partner_id: input.partnerId ?? null,
      source_id: resolvedSourceId,
      source_type: resolvedSourceType,
      activity_type: activityType,
      title: buildActivityTitle(input),
      description: `${channelLabel(input.channel)} inviato a ${input.to}`,
      email_subject: input.channel === "email" ? input.subject : undefined,
      email_body: input.channel === "email" ? input.body : undefined,
      status: "completed",
      completed_at: now,
      sent_at: now,
      priority: "medium",
      ...(input.agentId ? { executed_by_agent_id: input.agentId } : {}),
      ...(input.messageIdExternal
        ? { message_id_external: input.messageIdExternal }
        : {}),
      ...(input.threadId ? { thread_id: input.threadId } : {}),
      source_meta: {
        source: input.source,
        channel: input.channel,
        sequence_day: input.sequenceDay ?? 0,
        ...(input.meta || {}),
      },
    });
    if (!error) result.activityLogged = true;
  } catch (e) {
    console.warn("[postSendPipeline] activity insert failed:", e);
  }

  // === b. UPDATE LEAD STATUS (tutti i source_type) ===
  if (resolvedSourceType === "partner" && input.partnerId) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", input.partnerId)
        .eq("user_id", input.userId)
        .maybeSingle();

      if (partner) {
        const currentStatus = partner.lead_status || "new";

        if (currentStatus === "new" || !partner.lead_status) {
          // Transizione new → first_touch_sent
          const res = await applyLeadStatusChange(supabase, {
            table: "partners",
            recordId: input.partnerId,
            newStatus: "first_touch_sent",
            userId: input.userId,
            actor: { type: "system", name: "postSendPipeline" },
            decisionOrigin: "system_trigger",
            trigger: `Primo messaggio inviato (${input.channel}) via ${input.source}`,
            metadata: {
              channel: input.channel,
              sequence_day: input.sequenceDay ?? 0,
              source: input.source,
            },
          });
          if (res.applied) result.statusUpdated = true;
        } else {
          // Solo aggiorna timestamp
          await supabase
            .from("partners")
            .update({ last_interaction_at: now })
            .eq("id", input.partnerId)
            .eq("user_id", input.userId);
        }
      }
    } catch (e) {
      console.warn("[postSendPipeline] partner status update failed:", e);
    }
  } else if (resolvedSourceType === "imported_contact" && (input.contactId || input.sourceId)) {
    // LOVABLE-93: imported_contact lead_status escalation
    const cid = input.contactId || input.sourceId!;
    try {
      const { data: contact } = await supabase
        .from("imported_contacts")
        .select("lead_status")
        .eq("id", cid)
        .maybeSingle();

      if (contact) {
        const currentStatus = contact.lead_status || "new";
        if (currentStatus === "new" || !contact.lead_status) {
          const res = await applyLeadStatusChange(supabase, {
            table: "imported_contacts",
            recordId: cid,
            newStatus: "first_touch_sent",
            userId: input.userId,
            actor: { type: "system", name: "postSendPipeline" },
            decisionOrigin: "system_trigger",
            trigger: `Primo messaggio inviato (${input.channel}) via ${input.source}`,
            contactIdForAudit: cid,
            metadata: { channel: input.channel, source: input.source },
          });
          if (res.applied) result.statusUpdated = true;
        } else {
          await supabase
            .from("imported_contacts")
            .update({ last_interaction_at: now })
            .eq("id", cid);
        }
      }
    } catch (e) {
      console.warn("[postSendPipeline] contact status update failed:", e);
    }
  } else if (resolvedSourceType === "business_card" && (input.businessCardId || input.sourceId)) {
    // LOVABLE-93: business_card lead_status escalation
    const bcid = input.businessCardId || input.sourceId!;
    try {
      const { data: bc } = await supabase
        .from("business_cards")
        .select("lead_status")
        .eq("id", bcid)
        .maybeSingle();

      if (bc) {
        const currentStatus = bc.lead_status || "new";
        if (currentStatus === "new" || !bc.lead_status) {
          await supabase
            .from("business_cards")
            .update({ lead_status: "first_touch_sent" })
            .eq("id", bcid);
          result.statusUpdated = true;
        }
      }
    } catch (e) {
      console.warn("[postSendPipeline] business_card status update failed:", e);
    }
  }

  // === c. CREA REMINDER FOLLOW-UP ===
  if (input.partnerId) {
    try {
      const leadStatus = await getPartnerStatus(
        supabase,
        input.partnerId,
        input.userId,
      );
      const isFirstContact = !leadStatus || leadStatus === "first_touch_sent";
      const days = getFollowUpDays(input.channel, leadStatus, isFirstContact);
      const dueDate = new Date(Date.now() + days * 86400000);

      // Per email: usa la sequenza se disponibile
      const seqDay = input.sequenceDay ?? 0;
      const nextSeq = SEQUENCE_NEXT[seqDay];

      if (nextSeq && input.channel === "email") {
        // Sequenza canonica
        const seqDueDate = new Date(
          Date.now() + (nextSeq.nextDay - seqDay) * 86400000,
        );
        const { error } = await supabase.from("activities").insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          source_id: input.partnerId,
          source_type: "partner",
          activity_type: "follow_up",
          title: `Sequenza G${nextSeq.nextDay} (${nextSeq.channel})`,
          description: `Follow-up automatico — canale: ${nextSeq.channel}. Step ${nextSeq.nextDay} della sequenza primo contatto.`,
          status: "pending",
          priority: "normal",
          due_date: seqDueDate.toISOString(),
          scheduled_at: seqDueDate.toISOString(),
          source_meta: {
            sequence_day: nextSeq.nextDay,
            channel: nextSeq.channel,
            prev_day: seqDay,
            source: input.source,
          },
        });
        if (!error) result.reminderCreated = true;
      } else if (input.channel !== "linkedin") {
        // Reminder generico per email/whatsapp (non LinkedIn — LinkedIn non crea reminder auto)
        const { error } = await supabase.from("activities").insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          source_id: input.partnerId,
          source_type: "partner",
          activity_type: "follow_up",
          title: `Follow-up ${channelLabel(input.channel)} (T+${days}gg)`,
          description: `Reminder automatico post-invio. Canale: ${input.channel}. Source: ${input.source}.`,
          status: "pending",
          priority: "normal",
          due_date: dueDate.toISOString(),
          scheduled_at: dueDate.toISOString(),
          source_meta: {
            channel: input.channel,
            follow_up_days: days,
            source: input.source,
          },
        });
        if (!error) result.reminderCreated = true;
      }
    } catch (e) {
      console.warn("[postSendPipeline] reminder creation failed:", e);
    }
  }

  // === d + e. NEXT ACTION GARANTITA ===
  if (input.partnerId && !result.reminderCreated) {
    try {
      const { count } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .eq("partner_id", input.partnerId)
        .eq("status", "pending");

      if (!count || count === 0) {
        const dueDate = new Date(Date.now() + 14 * 86400000);
        const { error } = await supabase.from("activities").insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          source_id: input.partnerId,
          source_type: "partner",
          activity_type: "follow_up",
          title: "Follow-up review (auto)",
          description:
            "Next-action garantita post-invio. Da raffinare manualmente.",
          status: "pending",
          priority: "low",
          due_date: dueDate.toISOString(),
          scheduled_at: dueDate.toISOString(),
          source_meta: { source: input.source, auto_generated: true },
        });
        if (!error) result.nextActionEnsured = true;
      } else {
        result.nextActionEnsured = true;
      }
    } catch (e) {
      console.warn("[postSendPipeline] next action check failed:", e);
    }
  }

  // === f. INCREMENTA TOUCH COUNT ===
  if (input.partnerId) {
    try {
      await supabase.rpc("increment_partner_interaction", {
        p_partner_id: input.partnerId,
      });
      result.touchCountIncremented = true;
    } catch (e) {
      console.warn("[postSendPipeline] touch count increment failed:", e);
    }
  }

  // === f-bis. ORACLE REFRESH CHECK — Se enrichment è stale, crea pending action ===
  if (input.partnerId) {
    try {
      const { data: partner } = await supabase
        .from("partners")
        .select("enrichment_data")
        .eq("id", input.partnerId)
        .maybeSingle();

      if (partner?.enrichment_data) {
        const enrichData = partner.enrichment_data as Record<string, unknown>;
        const lastEnrichAt = enrichData.last_enrichment_at as string | null | undefined;
        if (lastEnrichAt) {
          const daysSinceEnrichment = Math.floor((Date.now() - new Date(lastEnrichAt).getTime()) / 86400000);
          if (daysSinceEnrichment > 30) {
            // Create pending action for enrichment refresh
            await supabase.from("ai_pending_actions").insert({
              user_id: input.userId,
              action_type: "refresh_enrichment",
              target_type: "partner",
              target_id: input.partnerId,
              priority: "low",
              status: "pending",
              context: {
                enrichment_age_days: daysSinceEnrichment,
                last_enrichment_at: lastEnrichAt,
                trigger: "post_send_pipeline_stale_check",
                channel: input.channel,
              },
              created_at: now,
            });
          }
        }
      }
    } catch (e) {
      console.warn("[postSendPipeline] oracle refresh check failed:", e);
    }
  }

  // === LOG INTERACTION (per retrocompatibilità con interactions table) ===
  if (resolvedSourceType === "partner" && input.partnerId) {
    try {
      await supabase.from("interactions").insert({
        partner_id: input.partnerId,
        user_id: input.userId,
        interaction_type: input.channel,
        subject: `${channelLabel(input.channel)} a ${input.to}: ${input.subject || ""}`,
        notes: input.body || "",
        interaction_date: now,
      });
    } catch {
      // Silenzioso: interactions è una tabella legacy
    }
  } else if (resolvedSourceType === "imported_contact" && (input.contactId || input.sourceId)) {
    // LOVABLE-93: contact_interaction per imported_contact
    const cid = input.contactId || input.sourceId!;
    try {
      const { error } = await supabase.from("contact_interactions").insert({
        contact_id: cid,
        interaction_type: input.channel === "email" ? "email" : "other",
        title: input.subject || buildActivityTitle(input),
        description: input.body || null,
        created_by: input.userId,
      });
      if (!error) result.contactInteractionLogged = true;
    } catch (e) {
      console.warn("[postSendPipeline] contact_interaction insert failed:", e);
    }
  }

  // === g. SUPERVISOR AUDIT LOG (LOVABLE-93 — tutti i canali) ===
  try {
    await logSupervisorAudit(supabase, {
      user_id: input.userId,
      actor_type: input.actorType || (input.agentId ? "ai_agent" : "user"),
      actor_id: input.agentId,
      action_category: `send_${input.channel}`,
      action_detail: `${channelLabel(input.channel)} inviato a ${input.to}${input.subject ? `: ${input.subject}` : ""}`,
      target_type: resolvedSourceType,
      target_id: resolvedSourceId,
      target_label: input.to,
      partner_id: input.partnerId || (resolvedSourceType === "partner" ? resolvedSourceId : undefined),
      contact_id: input.contactId || (resolvedSourceType === "imported_contact" ? resolvedSourceId : undefined),
      email_address: input.channel === "email" ? input.to : undefined,
      decision_origin: input.decisionOrigin || "manual",
      metadata: {
        channel: input.channel,
        source: input.source,
        sequence_day: input.sequenceDay ?? 0,
        message_id_external: input.messageIdExternal,
        thread_id: input.threadId,
        ...(input.meta || {}),
      },
    });
    result.auditLogged = true;
  } catch (e) {
    console.warn("[postSendPipeline] supervisor audit failed:", e);
  }

  return result;
}

// === Utility ===

function channelToActivityType(channel: SendChannel): string {
  switch (channel) {
    case "email":
      return "send_email";
    case "whatsapp":
      return "whatsapp_message";
    case "linkedin":
      return "linkedin_message";
    case "sms":
      return "sms_message";
  }
}

function channelLabel(channel: SendChannel): string {
  switch (channel) {
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "linkedin":
      return "LinkedIn";
    case "sms":
      return "SMS";
  }
}

function buildActivityTitle(input: PostSendPipelineInput): string {
  const label = channelLabel(input.channel);
  const subj = input.subject ? `: ${input.subject}` : "";
  return `${label} inviata${subj}`;
}

async function getPartnerStatus(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("partners")
      .select("lead_status")
      .eq("id", partnerId)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.lead_status || "new";
  } catch {
    return "new";
  }
}
