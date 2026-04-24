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
import { createReminder, ensureNextAction } from "./reminderManager.ts";
import { checkAndCreateEnrichmentRefresh } from "./oracleRefresh.ts";
import { logInteractions } from "./interactionLogger.ts";
import { logSupervisorAudit } from "./supervisorAudit.ts";
import { channelLabel } from "./pipelineUtils.ts";
import { createEvent, publishAndPersist } from "./domainEvents.ts";
import { initLeadProcessManager } from "./processManagers/leadProcessManager.ts";

type SupabaseClient = any;

// FIX ISSUE 2: Helper to detect manual email edits
function calculateSimilarity(text1: string, text2: string): number {
  // Simple similarity check: compare normalized text length ratio
  // If edited, expect >10% difference in substantive content
  const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const n1 = normalize(text1);
  const n2 = normalize(text2);
  if (n1 === n2) return 1.0; // Identical
  const longer = Math.max(n1.length, n2.length);
  if (longer === 0) return 0.0;
  // Simple Levenshtein-like: count character diff ratio
  let diff = 0;
  for (let i = 0; i < Math.min(n1.length, n2.length); i++) {
    if (n1[i] !== n2[i]) diff++;
  }
  diff += Math.abs(n1.length - n2.length);
  return 1.0 - (diff / longer);
}

async function detectAndLogEmailEdit(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string | null | undefined,
  sentBody: string | undefined,
  now: string,
): Promise<boolean> {
  // FIX ISSUE 2: Compare sent body with last AI-generated version
  if (!partnerId || !sentBody) return false;

  try {
    // Find the most recent email activity for this partner with an email_body
    const { data: lastActivities } = await supabase
      .from("activities")
      .select("email_body, created_at")
      .eq("user_id", userId)
      .eq("partner_id", partnerId)
      .eq("activity_type", "email")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!lastActivities || lastActivities.length === 0) return false;

    const lastActivity = lastActivities[0];
    if (!lastActivity.email_body) return false;

    // Calculate similarity between sent body and previous version
    const similarity = calculateSimilarity(sentBody, lastActivity.email_body);

    // If similarity < 0.85 (>15% different), flag as manual edit
    if (similarity < 0.85) {
      // Create a suggested_improvement record for admin review
      const editDiff = `Previous AI body vs sent body: ~${Math.round((1 - similarity) * 100)}% difference detected`;
      await supabase.from("suggested_improvements").insert({
        created_by: userId,
        source_context: "email_edit",
        suggestion_type: "user_preference",
        title: "Manual email edit detected",
        content: editDiff,
        reasoning: `User edited email before sending to partner. Original was ~${Math.round(similarity * 100)}% similar.`,
        priority: "low",
        status: "approved", // Auto-approve as user_preference (observational learning)
        reviewed_by: userId,
        reviewed_at: now,
      });
      return true;
    }
  } catch (e) {
    console.warn("[postSendPipeline] email edit detection failed:", e);
  }
  return false;
}

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
      result.skippedAsDuplicate = true;
      return result;
    }
  }

  // === a. LOG ACTIVITY ===
  result.activityLogged = await logActivity(supabase, input, resolvedSourceId, resolvedSourceType, now);

  // === a-bis. DETECT MANUAL EMAIL EDITS (FIX ISSUE 2) ===
  // After logging activity, check if email was manually edited vs last AI version
  if (input.channel === "email" && input.partnerId && input.body) {
    await detectAndLogEmailEdit(supabase, input.userId, input.partnerId, input.body, now);
  }

  // === b. UPDATE LEAD STATUS (via LeadProcessManager + DomainEvent) ===
  // Tutti i tipi entità passano dal LeadPM. Niente più fallback diretto.
  const leadPM = initLeadProcessManager(supabase);
  if (resolvedSourceType === "partner" && input.partnerId) {
    // Pubblica EmailSent → il PM reagisce con new→first_touch_sent se necessario
    const emailSentEvent = createEvent("email.sent", input.userId,
      { type: (input.actorType || "system") as "user" | "system" | "cron" | "ai_agent", name: `postSendPipeline/${input.source}` },
      {
        partnerId: input.partnerId,
        contactId: input.contactId || undefined,
        contactEmail: input.to,
        subject: input.subject || "",
        channel: "email",
        sequenceDay: input.sequenceDay,
      },
    );
    await publishAndPersist(supabase, emailSentEvent);
    result.statusUpdated = true;
  } else if (resolvedSourceType === "imported_contact" && (input.contactId || input.sourceId)) {
    // imported_contacts: LeadPM gestisce direttamente
    const cid = input.contactId || input.sourceId!;
    try {
      const res = await leadPM.onImportedContactOutbound(cid, input.userId, input.channel, input.source);
      result.statusUpdated = res.applied;
    } catch (e) {
      console.warn("[postSendPipeline] LeadPM imported_contact update failed:", e);
    }
  } else if (resolvedSourceType === "business_card" && (input.businessCardId || input.sourceId)) {
    // business_cards: LeadPM gestisce direttamente
    const bcid = input.businessCardId || input.sourceId!;
    try {
      const res = await leadPM.onBusinessCardOutbound(bcid, input.channel, input.source);
      result.statusUpdated = res.applied;
    } catch (e) {
      console.warn("[postSendPipeline] LeadPM business_card update failed:", e);
    }
  }

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

// Types are already exported above via `export interface`.
