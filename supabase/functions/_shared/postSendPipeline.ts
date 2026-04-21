/**
 * postSendPipeline.ts — Pipeline unificata post-invio (LOVABLE-85).
 *
 * TUTTI i punti di invio (send-email, process-email-queue, agent-execute,
 * cadence-engine, pending-action-executor) DEVONO passare per questa pipeline.
 *
 * Esegue in ordine:
 *   a. Log activity (tipo, canale, partner, contact, timestamp)
 *   b. Update lead_status (new→first_touch_sent, o nessun cambio se già avanzato)
 *   c. Crea reminder follow-up con timing per canale
 *   d. Calcola next_action dalla sequenza
 *   e. Crea ai_pending_action per prossimo step
 *   f. Incrementa touch_count sul partner
 *
 * Idempotenza: check su (partner_id, channel, created_at within 60s) per evitare duplicati.
 */

import { applyLeadStatusChange } from "./leadStatusGuard.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type SendChannel = "email" | "whatsapp" | "linkedin";

export interface PostSendPipelineInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
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
  /** Message ID esterno (SMTP) */
  messageIdExternal?: string;
  /** Thread ID per raggruppamento */
  threadId?: string;
}

export interface PostSendPipelineResult {
  activityLogged: boolean;
  statusUpdated: boolean;
  reminderCreated: boolean;
  nextActionEnsured: boolean;
  touchCountIncremented: boolean;
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
    skippedAsDuplicate: false,
  };

  const now = new Date().toISOString();

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
      source_id: input.partnerId || input.contactId || crypto.randomUUID(),
      source_type: input.partnerId ? "partner" : "imported_contact",
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

  // === b. UPDATE LEAD STATUS ===
  if (input.partnerId) {
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
      console.warn("[postSendPipeline] status update failed:", e);
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

  // === LOG INTERACTION (per retrocompatibilità con interactions table) ===
  if (input.partnerId) {
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
