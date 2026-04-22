/**
 * activityLogger.ts — Activity logging for post-send pipeline.
 */
import type { SendChannel, SourceType, PostSendPipelineInput } from "./postSendPipeline.ts";
import { channelToActivityType, channelLabel, buildActivityTitle } from "./pipelineUtils.ts";

type SupabaseClient = any;

export async function logActivity(
  supabase: SupabaseClient,
  input: PostSendPipelineInput,
  resolvedSourceId: string,
  resolvedSourceType: SourceType,
  now: string,
): Promise<boolean> {
  try {
    const activityType = channelToActivityType(input.channel);
    const { error } = await supabase.from("activities").insert({
      user_id: input.userId,
      partner_id: input.partnerId ?? null,
      source_id: resolvedSourceId,
      source_type: resolvedSourceType,
      activity_type: activityType,
      title: buildActivityTitle(input.channel, input.subject),
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
    return !error;
  } catch (e) {
    console.warn("[activityLogger] activity insert failed:", e);
    return false;
  }
}
