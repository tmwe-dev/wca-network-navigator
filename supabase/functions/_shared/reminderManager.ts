/**
 * reminderManager.ts — Follow-up reminder creation and next-action guarantee.
 */
import type { SendChannel, PostSendPipelineInput } from "./postSendPipeline.ts";
import { channelLabel, getPartnerStatus } from "./pipelineUtils.ts";

type SupabaseClient = any;

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
  return 7; // LinkedIn: tempi più lunghi
}

export async function createReminder(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
  now: string,
): Promise<boolean> {
  if (!input.partnerId) return false;

  try {
    const leadStatus = await getPartnerStatus(
      supabase,
      input.partnerId,
      input.userId,
    );
    const isFirstContact = !leadStatus || leadStatus === "first_touch_sent";
    const days = getFollowUpDays(input.channel, leadStatus, isFirstContact);
    const dueDate = new Date(Date.now() + days * 86400000);

    const seqDay = input.sequenceDay ?? 0;
    const nextSeq = SEQUENCE_NEXT[seqDay];

    if (nextSeq && input.channel === "email") {
      // Canonical sequence
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
      return !error;
    } else if (input.channel !== "linkedin") {
      // Generic reminder for email/whatsapp
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
      return !error;
    }
  } catch (e) {
    console.warn("[reminderManager] reminder creation failed:", e);
  }

  return false;
}

export async function ensureNextAction(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
  now: string,
): Promise<boolean> {
  if (!input.partnerId) return false;

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
      return !error;
    } else {
      return true;
    }
  } catch (e) {
    console.warn("[reminderManager] next action check failed:", e);
  }

  return false;
}
