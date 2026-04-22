/**
 * postSendPipeline.ts — Unified post-send orchestrator (LOVABLE-85 + LOVABLE-93).
 *
 * All send points (send-email, process-email-queue, agent-execute, cadence-engine,
 * pending-action-executor, log-action edge) MUST pass through this pipeline.
 * Supports ALL channels and ALL source_type.
 *
 * Executes in order:
 *   a. Log activity (type, channel, partner/contact/business_card, timestamp)
 *   b. Update lead_status (new→first_touch_sent, or no change if already advanced)
 *      — Supports: partners, imported_contacts, business_cards
 *   c. Create interaction / contact_interaction based on source_type
 *   d. Create reminder follow-up with channel timing (partners only)
 *   e. Ensure next_action from sequence
 *   f. Increment touch_count on partner
 *   g. Write supervisor_audit_log for EVERY send (LOVABLE-93)
 *
 * Idempotency: check on (partner_id, channel, created_at within 60s) to avoid duplicates.
 */

import { logActivity } from "./activityLogger.ts";
import { updateLeadStatus } from "./leadStatusUpdater.ts";
import { createReminder, ensureNextAction } from "./reminderManager.ts";
import { checkAndCreateEnrichmentRefresh } from "./oracleRefresh.ts";
import { logInteractions } from "./interactionLogger.ts";
import { logSupervisorAudit } from "./supervisorAudit.ts";
import { channelLabel } from "./pipelineUtils.ts";

type SupabaseClient = any;

export type SendChannel = "email" | "whatsapp" | "linkedin" | "sms";
export type SourceType = "partner" | "imported_contact" | "business_card";

export interface PostSendPipelineInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  sourceType?: SourceType;
  sourceId?: string | null;
  businessCardId?: string | null;
  channel: SendChannel;
  subject?: string;
  body?: string;
  to: string;
  sequenceDay?: number;
  agentId?: string;
  source: "email_forge" | "agent" | "cadence" | "batch" | "pending_action" | "manual";
  meta?: Record<string, unknown>;
  messageIdExternal?: string;
  threadId?: string;
  decisionOrigin?: "manual" | "ai_auto" | "ai_approved" | "system_trigger";
  actorType?: "user" | "ai_agent" | "system" | "cron";
}

export interface PostSendPipelineResult {
  activityLogged: boolean;
  statusUpdated: boolean;
  reminderCreated: boolean;
  nextActionEnsured: boolean;
  touchCountIncremented: boolean;
  auditLogged: boolean;
  contactInteractionLogged: boolean;
  skippedAsDuplicate: boolean;
}

/**
 * Main unified pipeline. Call for EVERY successful send.
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

  // LOVABLE-93: Resolve source type (retrocompat: default = partner if partnerId present)
  const resolvedSourceType: SourceType = input.sourceType
    || (input.partnerId ? "partner" : input.contactId ? "imported_contact" : "partner");
  const resolvedSourceId = input.sourceId
    || input.partnerId || input.contactId || input.businessCardId || crypto.randomUUID();

  // === IDEMPOTENCY CHECK ===
  if (input.partnerId) {
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
    const activityType = input.channel === "email"
      ? "send_email"
      : input.channel === "whatsapp"
      ? "whatsapp_message"
      : input.channel === "linkedin"
      ? "linkedin_message"
      : "sms_message";
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
  result.activityLogged = await logActivity(supabase, input, resolvedSourceId, resolvedSourceType, now);

  // === b. UPDATE LEAD STATUS ===
  result.statusUpdated = await updateLeadStatus(supabase, input, resolvedSourceType, resolvedSourceId, now);

  // === c. CREATE REMINDER FOLLOW-UP ===
  result.reminderCreated = await createReminder(supabase, input, now);

  // === d + e. NEXT ACTION GUARANTEED ===
  result.nextActionEnsured = await ensureNextAction(supabase, input, now);

  // === f. INCREMENT TOUCH COUNT ===
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

  // === f-bis. ORACLE REFRESH CHECK ===
  await checkAndCreateEnrichmentRefresh(supabase, input, now);

  // === LOG INTERACTIONS ===
  const interactionResult = await logInteractions(supabase, input, resolvedSourceType, resolvedSourceId, now);
  result.contactInteractionLogged = interactionResult.contactInteractionLogged;

  // === g. SUPERVISOR AUDIT LOG ===
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

// Re-export types for convenience
export type { PostSendPipelineInput, PostSendPipelineResult };
